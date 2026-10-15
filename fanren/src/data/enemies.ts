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
  // 第十五步：妖兽等阶（原著一至十级：1 炼气 · 2–4 筑基 · 5–7 结丹 · 8–10 元婴）
  lv?: [number, number];
  /** flee=见人即逃（双瞳鼠、土甲龙、阴芝马）；shy=不主动伤人（炙角鹿）；call=示警召集同类（云翅鸟） */
  behave?: 'flee' | 'shy' | 'call';
  hide?: boolean;              // 擅隐匿：神识需贴近方能察觉
  lair?: boolean;              // 妖王：只在固定巢穴出现
}

const E: EnemyDef[] = [
  // ---- 炼气级 ----
  { id: 'wolf', name: '青背苍狼', kind: 'beast', lv: [1, 1], look: { body: 'wolf', color: [98, 112, 118], belly: [200, 190, 170], size: 1 }, minDanger: 0, maxDanger: 2, hp: 0.55, atk: 0.6, def: 0.6, speed: 150, melee: { range: 60, power: 1, cd: 1.2 }, pack: [1, 3], drops: [{ id: 'mat_yaodan1', ch: 0.35 }, { id: 'mat_lingshi', ch: 0.6, n: [1, 4] }] },
  { id: 'redwolf', name: '三眼火狼', kind: 'beast', lv: [1, 1], look: { body: 'wolf', color: [150, 66, 40], belly: [220, 170, 120], size: 1.15, eye: 'rgba(255,90,30,0.95)', eye3: true, glow: '255,110,50' }, minDanger: 1, maxDanger: 3, zone: 'grass', hp: 0.7, atk: 0.75, def: 0.7, speed: 170, melee: { range: 64, power: 1.1, cd: 1.1, status: { k: 'break', dur: 3, ch: 0.2 } }, pack: [2, 4], drops: [{ id: 'mat_yaodan1', ch: 0.5 }, { id: 'mat_lingshi', ch: 0.6, n: [2, 6] }] },
  { id: 'boar', name: '推山兽', kind: 'beast', lv: [1, 1], look: { body: 'boar', color: [92, 72, 58], belly: [150, 120, 96], size: 1.05 }, minDanger: 0, maxDanger: 2, zone: 'forest', hp: 0.8, atk: 0.7, def: 0.9, speed: 130, melee: { range: 64, power: 1.4, cd: 1.6, status: { k: 'knock', dur: 0.3, ch: 0.5 } }, drops: [{ id: 'mat_yaodan1', ch: 0.4 }, { id: 'mat_lingshi', ch: 0.5, n: [1, 5] }] },
  { id: 'greensnake', name: '妖冠蛇', kind: 'beast', lv: [1, 1], look: { body: 'snake', color: [44, 42, 40], belly: [120, 110, 96], size: 0.8, horn: true, accent: [170, 60, 50], eye: 'rgba(220,255,80,0.95)' }, minDanger: 0, maxDanger: 2, zone: 'forest', hp: 0.45, atk: 0.7, def: 0.5, speed: 120, melee: { range: 70, power: 0.9, cd: 1.1, status: { k: 'poison', dur: 4, ch: 0.5 } }, drops: [{ id: 'mat_yaodan1', ch: 0.35 }, { id: 'herb_jinxin', ch: 0.15 }] },
  { id: 'spider', name: '黑纹毒蛛', kind: 'insect', lv: [1, 1], look: { body: 'spider', color: [52, 46, 44], accent: [200, 60, 40], size: 0.9 }, minDanger: 1, maxDanger: 3, hp: 0.5, atk: 0.75, def: 0.6, speed: 140, melee: { range: 56, power: 0.9, cd: 1.0, status: { k: 'poison', dur: 5, ch: 0.6 } }, ranged: { fx: 'vine', color: '230,230,230', range: 380, power: 0.5, cd: 4, speed: 500, status: { k: 'root', dur: 1.2, ch: 0.8 } }, pack: [1, 3], drops: [{ id: 'mat_yaodan1', ch: 0.4 }, { id: 'mat_lingshi', ch: 0.5, n: [1, 4] }] },
  { id: 'hawk', name: '风啸鹰', kind: 'beast', lv: [1, 1], look: { body: 'eagle', color: [92, 80, 66], belly: [230, 220, 200], size: 0.95, tail: 'fan' }, minDanger: 0, maxDanger: 3, flying: true, hp: 0.45, atk: 0.75, def: 0.4, speed: 200, melee: { range: 60, power: 1, cd: 1.3 }, drops: [{ id: 'mat_yaodan1', ch: 0.35 }, { id: 'mat_lingshi', ch: 0.5, n: [1, 4] }] },
  { id: 'fox', name: '火狐', kind: 'beast', lv: [1, 2], look: { body: 'fox', color: [214, 104, 50], belly: [250, 226, 196], size: 0.9, tails: 2, glow: '255,150,80' }, minDanger: 1, maxDanger: 3, hp: 0.5, atk: 0.7, def: 0.5, speed: 180, ranged: { fx: 'fireball', color: '255,140,60', range: 420, power: 0.9, cd: 2.2, speed: 520, status: { k: 'stun', dur: 0.6, ch: 0.2 } }, drops: [{ id: 'mat_yaodan1', ch: 0.6 }, { id: 'mat_lingshi', ch: 0.6, n: [2, 6] }] },
  { id: 'bandit', name: '劫修', kind: 'human', robe: '#4a4a52', title: '散修', minDanger: 0, maxDanger: 3, hp: 0.7, atk: 0.8, def: 0.7, speed: 140, ranged: { fx: 'fireball', color: '255,130,60', range: 520, power: 1, cd: 1.8, speed: 640, status: { k: 'burn', dur: 3, ch: 0.2 } }, drops: [{ id: 'mat_lingshi', ch: 1, n: [6, 30] }, { id: 'pill_huiqi', ch: 0.25 }, { id: 'tal_fire', ch: 0.3 }, { id: 'art_qingfeng', ch: 0.06 }, { id: 'tal_tianleizi', ch: 0.04 }, { id: 'art_jinguangzhuan', ch: 0.025 }, { id: 'art_tayun', ch: 0.02 }] },
  // ---- 区域特有 ----
  { id: 'snowwolf', name: '冰火狼', kind: 'beast', lv: [1, 1], look: { body: 'wolf', color: [220, 226, 232], belly: [250, 250, 255], size: 1.2, eye: 'rgba(80,180,255,0.95)', glow: '180,220,255' }, minDanger: 1, maxDanger: 5, zone: 'cold', hp: 0.75, atk: 0.8, def: 0.8, speed: 170, melee: { range: 64, power: 1.1, cd: 1.1, status: { k: 'slow', dur: 2, ch: 0.5 } }, pack: [2, 4], drops: [{ id: 'mat_yaodan3', ch: 0.3 }, { id: 'herb_xuelian', ch: 0.15 }] },
  { id: 'icebear', name: '雪猿', kind: 'beast', lv: [4, 5], look: { body: 'ape', color: [222, 228, 234], belly: [246, 248, 252], size: 1.35, eye: 'rgba(80,180,255,0.95)' }, minDanger: 2, maxDanger: 5, zone: 'cold', hp: 1.5, atk: 1, def: 1.2, speed: 110, melee: { range: 80, power: 1.6, cd: 1.8, status: { k: 'freeze', dur: 1, ch: 0.3 } }, drops: [{ id: 'mat_yaodan3', ch: 0.6 }, { id: 'herb_bingpo', ch: 0.2 }] },
  { id: 'sandscorp', name: '巨毒蝎', kind: 'insect', lv: [1, 3], look: { body: 'scorpion', color: [190, 150, 90], accent: [160, 40, 30], size: 1.2 }, minDanger: 1, maxDanger: 5, zone: 'arid', hp: 0.8, atk: 0.85, def: 1.1, speed: 130, melee: { range: 70, power: 1.2, cd: 1.3, status: { k: 'poison', dur: 5, ch: 0.6 } }, pack: [1, 3], drops: [{ id: 'mat_yaodan3', ch: 0.3 }, { id: 'mat_lingshi', ch: 0.6, n: [3, 10] }] },
  { id: 'steppewolf', name: '草原妖狼', kind: 'beast', lv: [1, 2], look: { body: 'wolf', color: [150, 130, 90], belly: [220, 200, 160], size: 1.1 }, minDanger: 1, maxDanger: 4, regions: ['tianlan'], hp: 0.65, atk: 0.75, def: 0.7, speed: 175, melee: { range: 64, power: 1, cd: 1.1 }, pack: [3, 5], drops: [{ id: 'mat_yaodan1', ch: 0.5 }, { id: 'mat_lingshi', ch: 0.5, n: [2, 6] }] },
  { id: 'seaturtle', name: '铁甲海龟', kind: 'beast', lv: [2, 4], look: { body: 'turtle', color: [90, 120, 110], accent: [70, 90, 70], size: 1.3 }, minDanger: 1, maxDanger: 5, zone: 'sea', hp: 1.6, atk: 0.6, def: 1.6, speed: 90, ranged: { fx: 'water', color: '120,180,240', range: 460, power: 0.9, cd: 3, speed: 420, status: { k: 'slow', dur: 2, ch: 0.5 } }, drops: [{ id: 'mat_yaodan3', ch: 0.5 }, { id: 'mat_lingshi', ch: 0.6, n: [5, 15] }] },
  { id: 'seaserpent', name: '墨蛟', kind: 'beast', lv: [2, 4], look: { body: 'jiao', color: [50, 64, 80], belly: [150, 170, 180], accent: [220, 200, 150], size: 1.2, eye: 'rgba(255,220,60,0.95)' }, minDanger: 2, maxDanger: 5, zone: 'sea', hp: 1.3, atk: 1.05, def: 1, speed: 160, melee: { range: 90, power: 1.4, cd: 1.5 }, ranged: { fx: 'water', color: '90,140,200', range: 520, power: 1.2, cd: 3.5, speed: 460, status: { k: 'knock', dur: 0.3, ch: 0.5 } }, drops: [{ id: 'mat_mojiaoqi', ch: 0.55 }, { id: 'mat_mojiaozhao', ch: 0.45, n: [1, 2] }] },
  { id: 'yinhun', name: '阴魂', kind: 'ghost', look: { body: 'ghost', color: [150, 200, 190], size: 1 }, minDanger: 1, maxDanger: 4, zone: 'demon', evil: true, hp: 0.5, atk: 0.8, def: 0.4, speed: 120, flying: true, melee: { range: 60, power: 0.9, cd: 1.2, status: { k: 'slow', dur: 2, ch: 0.4 } }, ranged: { fx: 'ghost', color: '140,220,200', range: 420, power: 0.8, cd: 2.6, speed: 380, status: { k: 'poison', dur: 4, ch: 0.4 } }, pack: [1, 4], drops: [{ id: 'mat_lingshi', ch: 0.4, n: [2, 6] }] },
  { id: 'moxiu', name: '魔道弟子', kind: 'human', robe: '#5a1a22', title: '魔修', minDanger: 1, maxDanger: 4, zone: 'demon', evil: true, hp: 0.8, atk: 0.9, def: 0.8, speed: 150, ranged: { fx: 'blood', color: '220,40,60', range: 540, power: 1.1, cd: 1.8, speed: 600, status: { k: 'break', dur: 3, ch: 0.3 } }, drops: [{ id: 'mat_lingshi', ch: 1, n: [10, 40] }, { id: 'pill_huiqi', ch: 0.3 }, { id: 'tal_ice', ch: 0.2 }] },
  // ---- 筑基级 ----
  { id: 'firetiger', name: '火鳞兽', kind: 'beast', lv: [3, 4], look: { body: 'tiger', color: [186, 64, 40], belly: [240, 200, 150], accent: [120, 30, 20], size: 1.3, spikes: true, eye: 'rgba(255,200,60,0.95)', glow: '255,140,60' }, minDanger: 2, maxDanger: 5, hp: 1.2, atk: 1.05, def: 1, speed: 170, melee: { range: 76, power: 1.4, cd: 1.3, status: { k: 'burn', dur: 3, ch: 0.4 } }, ranged: { fx: 'fireball', color: '255,120,50', range: 460, power: 1.2, cd: 3.2, speed: 600, status: { k: 'burn', dur: 3, ch: 0.5 } }, drops: [{ id: 'mat_yaodan3', ch: 0.6 }, { id: 'herb_huolong', ch: 0.1 }] },
  { id: 'python', name: '金光蟒', kind: 'beast', lv: [1, 2], look: { body: 'snake', color: [176, 140, 50], belly: [240, 220, 150], size: 1.4, glow: '255,220,120', eye: 'rgba(255,240,140,0.95)' }, minDanger: 2, maxDanger: 5, zone: 'forest', hp: 1.5, atk: 1, def: 1.1, speed: 120, melee: { range: 96, power: 1.5, cd: 1.6, status: { k: 'root', dur: 1.2, ch: 0.4 } }, drops: [{ id: 'mat_yaodan3', ch: 0.6 }, { id: 'mat_lingshi', ch: 0.6, n: [10, 30] }] },
  { id: 'ironape', name: '金睛猿', kind: 'beast', lv: [2, 3], look: { body: 'ape', color: [110, 86, 60], belly: [180, 150, 110], size: 1.3, eye: 'rgba(255,220,40,1)', glow: '255,210,90' }, minDanger: 2, maxDanger: 5, zone: 'forest', hp: 1.4, atk: 1.1, def: 1.2, speed: 150, melee: { range: 80, power: 1.6, cd: 1.5, status: { k: 'stun', dur: 0.6, ch: 0.3 } }, drops: [{ id: 'mat_yaodan3', ch: 0.6 }, { id: 'mat_xuantie', ch: 0.2 }] },
  { id: 'facespider', name: '黑血蜘蛛', kind: 'insect', lv: [3, 4], look: { body: 'spider', color: [60, 24, 30], accent: [240, 220, 200], size: 1.4, eye: 'rgba(255,220,220,0.95)' }, minDanger: 3, maxDanger: 5, evil: true, hp: 1.1, atk: 1.05, def: 1, speed: 140, melee: { range: 66, power: 1.2, cd: 1.1, status: { k: 'poison', dur: 6, ch: 0.6 } }, ranged: { fx: 'vine', color: '240,240,240', range: 460, power: 0.6, cd: 3.5, speed: 520, status: { k: 'root', dur: 1.6, ch: 0.9 } }, drops: [{ id: 'mat_yaodan3', ch: 0.7 }] },
  { id: 'centipede', name: '巨型蜈蚣', kind: 'insect', lv: [2, 4], look: { body: 'centipede', color: [44, 40, 38], accent: [200, 60, 40], size: 1.3 }, minDanger: 2, maxDanger: 5, hp: 1, atk: 1.05, def: 1.1, speed: 160, melee: { range: 80, power: 1.2, cd: 1.0, status: { k: 'poison', dur: 5, ch: 0.6 } }, drops: [{ id: 'mat_yaodan3', ch: 0.5 }] },
  { id: 'bloodbat', name: '吸血蝠', kind: 'beast', lv: [2, 3], look: { body: 'bat', color: [140, 30, 36], belly: [150, 60, 60], size: 1.1, eye: 'rgba(255,30,30,0.95)' }, minDanger: 2, maxDanger: 5, zone: 'demon', evil: true, flying: true, hp: 0.6, atk: 0.95, def: 0.5, speed: 210, melee: { range: 56, power: 1, cd: 0.9, status: { k: 'break', dur: 3, ch: 0.3 } }, pack: [3, 6], drops: [{ id: 'mat_yaodan1', ch: 0.5 }] },
  { id: 'guijiang', name: '鬼将', kind: 'ghost', look: { body: 'ghost', color: [120, 90, 160], size: 1.5, eye: 'rgba(255,80,200,0.95)' }, minDanger: 3, maxDanger: 5, zone: 'demon', evil: true, flying: true, hp: 1.4, atk: 1.2, def: 0.8, speed: 130, ranged: { fx: 'ghost', color: '180,120,240', range: 520, power: 1.3, cd: 2.2, speed: 420, count: 3, status: { k: 'poison', dur: 5, ch: 0.5 } }, drops: [{ id: 'mat_lingshi', ch: 1, n: [20, 60] }, { id: 'mat_yaodan5', ch: 0.15 }] },
  { id: 'zhujixiu', name: '筑基劫修', kind: 'human', robe: '#2a3440', title: '劫修', minDanger: 3, maxDanger: 5, hp: 1, atk: 1, def: 1, speed: 170, ranged: { fx: 'sword', color: '200,230,240', range: 600, power: 1.2, cd: 1.4, speed: 860 }, drops: [{ id: 'mat_lingshi', ch: 1, n: [40, 160] }, { id: 'pill_huiqi', ch: 0.4 }, { id: 'tal_thunder', ch: 0.15 }, { id: 'art_yinhui', ch: 0.08 }, { id: 'art_guike', ch: 0.06 }] },
  // ---- 结丹级以上 ----
  { id: 'firejiao', name: '赤火蛟', kind: 'beast', lv: [5, 6], look: { body: 'jiao', color: [170, 60, 40], belly: [240, 180, 120], accent: [255, 220, 150], size: 1.7, eye: 'rgba(255,240,100,0.95)', glow: '255,120,60' }, minDanger: 4, maxDanger: 5, hp: 1.6, atk: 1.2, def: 1.2, speed: 170, melee: { range: 110, power: 1.5, cd: 1.6 }, ranged: { fx: 'flame', color: '255,110,40', range: 520, power: 1.4, cd: 3, speed: 560, radius: 90, status: { k: 'burn', dur: 4, ch: 0.7 } }, drops: [{ id: 'mat_chihuolin', ch: 0.8, n: [1, 3] }, { id: 'herb_huolong', ch: 0.3 }] },
  { id: 'jindan_mo', name: '结丹魔修', kind: 'human', robe: '#3a0a14', title: '魔道长老', minDanger: 5, maxDanger: 5, evil: true, hp: 1.2, atk: 1.15, def: 1.1, speed: 190, ranged: { fx: 'blood', color: '230,30,50', range: 640, power: 1.5, cd: 1.6, speed: 700, count: 3, status: { k: 'break', dur: 4, ch: 0.5 } }, drops: [{ id: 'mat_lingshi', ch: 1, n: [200, 600] }, { id: 'art_zhuxie', ch: 0.08 }, { id: 'tal_thunder', ch: 0.4 }] },
  // ---- 第十五步：原著妖兽谱 ----
  // 一级
  { id: 'shuangtong', name: '双瞳鼠', kind: 'beast', lv: [1, 1], behave: 'flee', hide: true, look: { body: 'rat', color: [120, 104, 88], belly: [210, 196, 176], size: 0.9, eye: 'rgba(160,240,255,1)', glow: '170,230,255' }, minDanger: 0, maxDanger: 3, hp: 0.35, atk: 0.4, def: 0.4, speed: 210, melee: { range: 44, power: 0.6, cd: 1 }, drops: [{ id: 'mat_shuangtongmu', ch: 0.9 }, { id: 'herb_lingzhi', ch: 0.3 }] },
  { id: 'chijin', name: '吃金鼠', kind: 'beast', lv: [1, 1], look: { body: 'rat', color: [196, 200, 206], belly: [240, 240, 244], size: 0.75, eye: 'rgba(255,60,60,1)' }, minDanger: 0, maxDanger: 3, zone: 'arid', hp: 0.35, atk: 0.6, def: 0.9, speed: 190, melee: { range: 44, power: 0.8, cd: 0.8, status: { k: 'break', dur: 3, ch: 0.25 } }, pack: [3, 6], drops: [{ id: 'mat_tiejing', ch: 0.6, n: [1, 3] }, { id: 'mat_chitong', ch: 0.15 }] },
  { id: 'zhijiao', name: '炙角鹿', kind: 'beast', lv: [1, 1], behave: 'shy', look: { body: 'deer', color: [168, 120, 80], belly: [236, 220, 196], size: 1.05, horn: true, accent: [230, 70, 40], eye: 'rgba(255,170,90,0.9)' }, minDanger: 0, maxDanger: 3, zone: 'forest', hp: 0.6, atk: 0.7, def: 0.6, speed: 220, melee: { range: 66, power: 1.2, cd: 1.4, status: { k: 'burn', dur: 3, ch: 0.5 } }, pack: [1, 3], drops: [{ id: 'mat_zhijiao', ch: 0.7 }] },
  { id: 'bishui', name: '碧水鳄', kind: 'beast', lv: [1, 1], look: { body: 'croc', color: [60, 96, 76], belly: [190, 196, 150], size: 1.15, spikes: true, accent: [40, 64, 50], eye: 'rgba(230,255,90,0.95)' }, minDanger: 1, maxDanger: 3, zone: 'forest', hp: 1.1, atk: 0.9, def: 1.3, speed: 110, melee: { range: 80, power: 1.6, cd: 1.8, status: { k: 'root', dur: 0.8, ch: 0.35 } }, drops: [{ id: 'mat_lingshi', ch: 0.5, n: [2, 6] }] },
  { id: 'tunhai', name: '吞海鱼', kind: 'beast', lv: [1, 1], look: { body: 'fish', color: [120, 140, 156], belly: [226, 232, 236], size: 1, spikes: true, accent: [150, 170, 186] }, minDanger: 0, maxDanger: 4, zone: 'sea', hp: 0.6, atk: 0.7, def: 0.8, speed: 140, melee: { range: 60, power: 1, cd: 1.2 }, ranged: { fx: 'water', color: '230,240,250', range: 380, power: 0.6, cd: 3.2, speed: 380, status: { k: 'slow', dur: 2, ch: 0.6 } }, pack: [2, 4], drops: [] },
  // 二级
  { id: 'yingyuan', name: '鹰鸢兽', kind: 'beast', lv: [2, 2], look: { body: 'eagle', color: [104, 74, 56], belly: [220, 196, 160], size: 1.3, crest: [210, 50, 40], tail: 'fan' }, minDanger: 3, maxDanger: 5, flying: true, hp: 0.8, atk: 1, def: 0.7, speed: 230, melee: { range: 70, power: 1.3, cd: 1.2, status: { k: 'break', dur: 3, ch: 0.3 } }, drops: [] },
  { id: 'yunchi', name: '云翅鸟', kind: 'beast', lv: [2, 2], behave: 'call', look: { body: 'eagle', color: [214, 178, 70], belly: [250, 236, 190], size: 0.65, tail: 'streamer', accent: [250, 230, 160] }, minDanger: 2, maxDanger: 5, flying: true, hp: 0.4, atk: 0.5, def: 0.4, speed: 300, melee: { range: 50, power: 0.6, cd: 1 }, drops: [{ id: 'mat_yunchiyu', ch: 0.9, n: [1, 3] }] },
  { id: 'yuanjiu', name: '猿鹫', kind: 'beast', lv: [2, 2], regions: ['tianlan'], look: { body: 'eagle', color: [96, 80, 60], belly: [170, 140, 100], size: 1.25, crest: [120, 96, 70], claws: 2 }, minDanger: 2, maxDanger: 5, flying: true, hp: 0.9, atk: 1, def: 0.8, speed: 220, melee: { range: 70, power: 1.3, cd: 1.2 }, pack: [1, 3], drops: [] },
  // 四级
  { id: 'xuexian', name: '血线蛟', kind: 'beast', lv: [4, 4], look: { body: 'jiao', color: [120, 30, 34], belly: [220, 120, 110], accent: [250, 90, 80], size: 1.35, eye: 'rgba(255,230,120,0.95)' }, minDanger: 4, maxDanger: 6, hp: 1.3, atk: 1.1, def: 1, speed: 170, melee: { range: 96, power: 1.4, cd: 1.4, status: { k: 'poison', dur: 5, ch: 0.5 } }, ranged: { fx: 'blood', color: '220,40,50', range: 520, power: 1.2, cd: 3, speed: 560 }, drops: [{ id: 'mat_lingshi', ch: 0.6, n: [20, 60] }] },
  { id: 'ziyun', name: '紫云鹰', kind: 'beast', lv: [4, 4], look: { body: 'eagle', color: [104, 70, 130], belly: [200, 180, 220], size: 1.4, tail: 'fan', glow: '180,130,255' }, minDanger: 4, maxDanger: 6, flying: true, hp: 1, atk: 1.15, def: 1.3, speed: 300, melee: { range: 74, power: 1.4, cd: 1 }, ranged: { fx: 'rock', color: '200,170,120', range: 460, power: 1, cd: 3.5, speed: 600 }, drops: [] },
  { id: 'yinzhima', name: '阴芝马', kind: 'beast', lv: [4, 4], behave: 'flee', hide: true, look: { body: 'horse', color: [236, 232, 226], belly: [252, 250, 246], size: 0.45, mane: true, eye: 'rgba(80,255,140,1)', glow: '170,255,200' }, minDanger: 3, maxDanger: 6, zone: 'demon', hp: 0.4, atk: 0.4, def: 0.6, speed: 280, melee: { range: 40, power: 0.5, cd: 1 }, drops: [{ id: 'mat_yinzhima', ch: 1 }] },
  // 五级
  { id: 'qianmu', name: '千目妖', kind: 'beast', lv: [5, 5], look: { body: 'urchin', color: [150, 50, 40], accent: [230, 70, 40], size: 1.4, eyes: 22 }, minDanger: 5, maxDanger: 6, zone: 'sea', hp: 1.5, atk: 1.1, def: 1.5, speed: 70, ranged: { fx: 'needle', color: '255,110,70', range: 560, power: 0.7, cd: 2.4, speed: 760, count: 5, status: { k: 'poison', dur: 5, ch: 0.4 } }, drops: [{ id: 'mat_qianmuyan', ch: 0.6 }] },
  { id: 'qingguang', name: '异种青光雕', kind: 'beast', lv: [5, 5], look: { body: 'eagle', color: [60, 120, 120], belly: [190, 230, 220], size: 1.6, tail: 'fan', glow: '120,255,220', crest: [90, 200, 190] }, minDanger: 5, maxDanger: 6, flying: true, hp: 1.1, atk: 1.15, def: 1, speed: 280, melee: { range: 80, power: 1.4, cd: 1.1 }, ranged: { fx: 'wind', color: '150,255,230', range: 520, power: 1.1, cd: 2.8, speed: 640 }, drops: [] },
  { id: 'xuehou', name: '雪吼兽', kind: 'beast', lv: [5, 6], look: { body: 'tiger', color: [232, 236, 240], belly: [250, 252, 255], size: 1.45, mane: true, eye: 'rgba(80,190,255,1)' }, minDanger: 5, maxDanger: 6, zone: 'cold', hp: 1.4, atk: 1.15, def: 1.1, speed: 190, melee: { range: 84, power: 1.5, cd: 1.3, status: { k: 'stun', dur: 0.5, ch: 0.25 } }, ranged: { fx: 'wind', color: '200,230,255', range: 360, power: 1, cd: 5, speed: 520, status: { k: 'freeze', dur: 0.8, ch: 0.4 } }, drops: [{ id: 'herb_bingpo', ch: 0.2 }] },
  { id: 'hanmei', name: '寒魅', kind: 'ghost', lv: [5, 6], look: { body: 'jelly', color: [170, 220, 250], size: 1.2 }, minDanger: 5, maxDanger: 6, zone: 'cold', flying: true, hp: 0.9, atk: 1.15, def: 0.7, speed: 120, ranged: { fx: 'icicle', color: '190,230,255', range: 520, power: 1.1, cd: 2.4, speed: 520, count: 2, status: { k: 'freeze', dur: 1, ch: 0.35 } }, drops: [{ id: 'herb_bingpo', ch: 0.25 }] },
  // 六级
  { id: 'yingli', name: '婴鲤兽', kind: 'beast', lv: [6, 6], look: { body: 'carp', color: [70, 120, 200], belly: [200, 226, 250], accent: [130, 180, 240], size: 1.5, face: 'baby' }, minDanger: 5, maxDanger: 6, zone: 'sea', hp: 1.5, atk: 1.2, def: 1.1, speed: 150, melee: { range: 80, power: 1.3, cd: 1.3 }, ranged: { fx: 'lightning', color: '120,190,255', range: 600, power: 1.5, cd: 3.2, speed: 900, status: { k: 'shock', dur: 1, ch: 0.45 } }, title: '妖兽·擅水罡神雷', drops: [] },
  { id: 'wohu', name: '卧虎鲨', kind: 'beast', lv: [6, 6], look: { body: 'shark', color: [100, 106, 112], belly: [226, 228, 230], size: 1.6, eye: 'rgba(255,200,60,1)' }, minDanger: 5, maxDanger: 6, zone: 'sea', hp: 1.7, atk: 1.3, def: 1.1, speed: 200, melee: { range: 96, power: 1.8, cd: 1.4, status: { k: 'break', dur: 4, ch: 0.5 } }, pack: [1, 2], drops: [] },
  { id: 'jiguan', name: '鸡冠蛟', kind: 'beast', lv: [6, 6], look: { body: 'jiao', color: [70, 90, 60], belly: [200, 200, 150], accent: [230, 60, 40], size: 1.6, spikes: true, eye: 'rgba(255,230,90,1)' }, minDanger: 5, maxDanger: 6, hp: 1.6, atk: 1.25, def: 1.2, speed: 170, melee: { range: 104, power: 1.6, cd: 1.5 }, ranged: { fx: 'flame', color: '255,120,60', range: 520, power: 1.3, cd: 3.2, speed: 520, status: { k: 'burn', dur: 3, ch: 0.5 } }, drops: [] },
  // 七级
  { id: 'qingfeng', name: '青风牛', kind: 'beast', lv: [7, 7], look: { body: 'ox', color: [70, 110, 100], belly: [150, 190, 170], accent: [220, 230, 210], size: 1.6, bull: true, glow: '120,255,200', eye: 'rgba(160,255,220,1)' }, minDanger: 6, maxDanger: 6, zone: 'grass', hp: 2, atk: 1.25, def: 1.4, speed: 170, melee: { range: 96, power: 2, cd: 1.8, status: { k: 'knock', dur: 0.4, ch: 0.6 } }, ranged: { fx: 'wind', color: '140,255,210', range: 480, power: 1.2, cd: 4, speed: 600 }, drops: [{ id: 'mat_qingfengjiao', ch: 0.7 }] },
  { id: 'bingjia', name: '冰甲蟒', kind: 'beast', lv: [7, 7], look: { body: 'snake', color: [226, 234, 240], belly: [250, 252, 255], accent: [170, 210, 240], size: 1.9, spikes: true, glow: '170,220,255', eye: 'rgba(80,180,255,1)' }, minDanger: 6, maxDanger: 6, zone: 'cold', hp: 2.1, atk: 1.25, def: 1.5, speed: 140, melee: { range: 110, power: 1.8, cd: 1.6, status: { k: 'freeze', dur: 1, ch: 0.4 } }, ranged: { fx: 'icicle', color: '200,235,255', range: 520, power: 1.3, cd: 3.4, speed: 520, status: { k: 'slow', dur: 2, ch: 0.6 } }, drops: [{ id: 'mat_bingjialin', ch: 0.7, n: [1, 2] }] },
  { id: 'bingning', name: '冰狞兽', kind: 'beast', lv: [7, 7], look: { body: 'tiger', color: [196, 204, 214], belly: [236, 240, 246], size: 1.75, mane: true, eye: 'rgba(120,220,255,1)', glow: '200,230,255' }, minDanger: 6, maxDanger: 6, zone: 'cold', hp: 1.9, atk: 1.3, def: 1.3, speed: 210, melee: { range: 90, power: 1.8, cd: 1.2, status: { k: 'freeze', dur: 0.8, ch: 0.35 } }, ranged: { fx: 'wind', color: '220,240,255', range: 500, power: 1.3, cd: 3, speed: 700 }, drops: [] },
  { id: 'tiechi', name: '铁翅雕', kind: 'beast', lv: [7, 7], look: { body: 'eagle', color: [66, 70, 78], belly: [170, 176, 186], size: 1.9, tail: 'fan', accent: [200, 210, 220] }, minDanger: 6, maxDanger: 6, flying: true, hp: 1.6, atk: 1.3, def: 1.5, speed: 300, melee: { range: 90, power: 1.7, cd: 1.1, status: { k: 'break', dur: 4, ch: 0.4 } }, ranged: { fx: 'needle', color: '210,220,230', range: 540, power: 0.8, cd: 2.6, speed: 820, count: 4 }, drops: [] },
  { id: 'tujia', name: '土甲龙', kind: 'beast', lv: [7, 7], behave: 'flee', look: { body: 'pangolin', color: [186, 150, 90], belly: [220, 196, 140], size: 1.15, eye: 'rgba(255,210,80,1)' }, minDanger: 5, maxDanger: 6, zone: 'arid', hp: 1.6, atk: 0.8, def: 3, speed: 230, melee: { range: 60, power: 1, cd: 1.5 }, title: '妖兽·擅寻天材地宝', drops: [{ id: 'mat_tujiapi', ch: 1 }, { id: 'herb_huolong', ch: 0.6 }, { id: 'herb_jiuqu', ch: 0.12 }, { id: 'mat_xuantie', ch: 0.6, n: [2, 5] }] },
  // 妖王巢穴（不随机刷新）
  { id: 'dujiao', name: '毒蛟', kind: 'beast', lv: [8, 8], lair: true, look: { body: 'jiao', color: [190, 40, 36], belly: [250, 170, 130], accent: [255, 220, 140], size: 2.5, spikes: true, eye: 'rgba(255,250,120,1)', glow: '255,80,60' }, minDanger: 99, maxDanger: -1, zone: 'sea', hp: 2.2, atk: 1.3, def: 1.3, speed: 190, melee: { range: 150, power: 1.8, cd: 1.6, status: { k: 'poison', dur: 6, ch: 0.7 } }, ranged: { fx: 'blood', color: '160,230,60', range: 640, power: 1.4, cd: 2.4, speed: 620, count: 3, status: { k: 'poison', dur: 6, ch: 0.6 } }, aggro: 900, title: '妖王', drops: [{ id: 'mat_dujiaolin', ch: 1, n: [2, 4] }] },
  { id: 'shuanggong', name: '六翼霜蚣', kind: 'insect', lv: [8, 8], lair: true, look: { body: 'centipede', color: [236, 242, 250], accent: [140, 200, 255], size: 2.2, wings: 3, glow: '170,220,255', eye: 'rgba(120,220,255,1)' }, minDanger: 99, maxDanger: -1, zone: 'cold', flying: true, hp: 2, atk: 1.35, def: 1.4, speed: 260, melee: { range: 120, power: 1.7, cd: 1.1, status: { k: 'freeze', dur: 1.2, ch: 0.5 } }, ranged: { fx: 'icicle', color: '200,235,255', range: 660, power: 1.5, cd: 2.2, speed: 640, count: 3, status: { k: 'freeze', dur: 1, ch: 0.4 } }, aggro: 900, title: '妖王', drops: [{ id: 'mat_shuanggongdu', ch: 1 }] },
  { id: 'fengxi', name: '风希', kind: 'beast', lv: [9, 9], lair: true, look: { body: 'eagle', color: [70, 110, 150], belly: [200, 220, 236], accent: [170, 220, 255], size: 2.4, tail: 'fish', claws: 2, crest: [120, 190, 240], glow: '160,220,255', eye: 'rgba(200,240,255,1)' }, minDanger: 99, maxDanger: -1, flying: true, hp: 2.4, atk: 1.4, def: 1.3, speed: 420, melee: { range: 120, power: 1.8, cd: 1, status: { k: 'break', dur: 4, ch: 0.5 } }, ranged: { fx: 'tornado', color: '170,230,255', range: 720, power: 1.6, cd: 2, speed: 700, count: 3, status: { k: 'knock', dur: 0.4, ch: 0.5 } }, aggro: 1000, title: '妖修·裂风兽', drops: [{ id: 'mat_leipenggu', ch: 1 }, { id: 'pill_biyan', ch: 0.6 }] },
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

/** 妖兽等阶 ↔ 境界：1 炼气 · 2/3/4 筑基初中后 · 5/6/7 结丹 · 8/9/10 元婴 */
export function lvOf(realm: number, stage: number): number {
  return realm <= 1 ? 1 : realm === 2 ? 2 + Math.min(2, stage) : realm === 3 ? 5 + Math.min(2, stage) : 8 + Math.min(2, stage);
}
export function lvRealm(lv: number, lianqiStage = 6): { realm: number; stage: number } {
  if (lv <= 1) return { realm: 1, stage: lianqiStage };
  if (lv <= 4) return { realm: 2, stage: lv - 2 };
  if (lv <= 7) return { realm: 3, stage: lv - 5 };
  return { realm: 4, stage: Math.min(2, lv - 8) };
}
const NUM = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
/** 原著称谓：一级妖兽再分下 / 中 / 上 / 顶阶 */
export function lvName(lv: number, stage = 0): string {
  return lv <= 1 ? `一级${stage < 4 ? '下' : stage < 8 ? '中' : stage < 11 ? '上' : '顶'}阶` : NUM[lv] + '级';
}
/** 妖兽在某危险度出没的权重：等阶覆盖当前危险度 → 1；高一级（越阶） → 0.12；否则不出现 */
export function lvWeight(def: EnemyDef, band: number, allowUp = true): number {
  if (!def.lv) return 0;
  if (def.lv[0] <= band && band <= def.lv[1]) return 1;
  if (allowUp && def.lv[0] === band + 1) return 0.12;
  return 0;
}
// 自动推出 min/maxDanger，供洞府守卫等旧逻辑使用
const LV_D: [number, number][] = [[0, 0], [0, 3], [3, 4], [4, 5], [4, 5], [5, 6], [6, 6], [6, 6], [99, -1], [99, -1], [99, -1]];
for (const e of E) if (e.lv && !e.lair) { e.minDanger = LV_D[e.lv[0]][0]; e.maxDanger = LV_D[e.lv[1]][1]; e.drops = e.drops.filter((d) => !d.id.startsWith('mat_yaodan')); }

/** 妖王巢穴：固定位置（地图坐标，×WORLD_SCALE），被斩杀后三年方有新妖王占据 */
export interface LairDef { id: string; enemy: string; x: number; y: number; name: string; desc: string }
export const LAIRS: LairDef[] = [
  { id: 'lair_fengxi', enemy: 'fengxi', x: 968, y: 404, name: '风希洞府', desc: '外星海深处，九级妖修风希的洞府。传闻他得了一具上古雷鹏的骨翅。' },
  { id: 'lair_dujiao', enemy: 'dujiao', x: 952, y: 418, name: '毒蛟海渊', desc: '八级毒蛟盘踞的海渊，与风希交好。' },
  { id: 'lair_shuanggong', enemy: 'shuanggong', x: 318, y: 62, name: '霜蚣冰窟', desc: '北寒雪原深处的冰窟，六翼霜蚣在此吞吐寒气。' },
];

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
