// 第二十七步：对手的招式 —— 每个敌人 1～4 门技能 + 首领大招与分阶段狂暴
// 技能先在地上亮出预警（红圈 / 扇形 / 直线），到点才结算，玩家可以闪避或走出范围。
// 招式按“身形 × 五行”自动配给，原著妖王另有专属招式。
import type { Combat, Enemy } from './combat';
import type { StatusSpec } from '../data/arts';
import { ENEMIES } from '../data/enemies';
import { audio } from './audio';

const TAU = Math.PI * 2;
const rand = (a: number, b: number) => a + Math.random() * (b - a);

export type El = 'phys' | 'fire' | 'ice' | 'water' | 'thunder' | 'poison' | 'blood' | 'ghost' | 'wind' | 'earth' | 'sword' | 'gold' | 'metal';
export type SkKind = 'salvo' | 'ring' | 'circle' | 'rain' | 'cone' | 'charge' | 'leap' | 'nova' | 'beam' | 'summon' | 'guard' | 'blink' | 'heal' | 'roar';
export interface FoeSkill {
  id: string; name: string; k: SkKind; el: El; cd: number; tele: number; pow: number; range: number; min?: number;
  r?: number; n?: number; len?: number; w?: number; spread?: number; dur?: number; waves?: number;
  status?: StatusSpec; pool?: number; ult?: boolean; minion?: string; hpBelow?: number; once?: boolean;
}

export const EL_COL: Record<El, string> = {
  phys: '230,200,160', fire: '255,120,40', ice: '150,215,255', water: '90,170,255', thunder: '170,190,255', poison: '140,220,70',
  blood: '230,40,60', ghost: '150,230,200', wind: '190,255,225', earth: '210,170,110', sword: '210,255,240', gold: '255,215,90', metal: '220,225,235',
};
const EL_NAME: Record<El, string> = { phys: '', fire: '火', ice: '冰', water: '水', thunder: '雷', poison: '毒', blood: '血', ghost: '阴', wind: '风', earth: '土', sword: '剑', gold: '金', metal: '金' };
/** 弹道外观 */
const EL_PROJ: Record<El, string> = { phys: 'rock', fire: 'fireball', ice: 'icicle', water: 'water', thunder: 'lightning', poison: 'vine', blood: 'blood', ghost: 'ghost', wind: 'wind', earth: 'rock', sword: 'sword', gold: 'goldthunder', metal: 'needle' };
/** 落点爆开的光效（复用法术特效） */
const EL_BOOM: Record<El, string> = { phys: 'rock', fire: 'flame', ice: 'frost', water: 'water', thunder: 'lightning', poison: 'poison', blood: 'blood', ghost: 'ghost', wind: 'wind', earth: 'rock', sword: 'sword', gold: 'goldthunder', metal: 'sword' };
const EL_ST: Partial<Record<El, StatusSpec>> = {
  fire: { k: 'burn', dur: 3, ch: 0.5 }, ice: { k: 'slow', dur: 2.5, ch: 0.6 }, thunder: { k: 'shock', dur: 0.8, ch: 0.4 }, poison: { k: 'poison', dur: 5, ch: 0.7 },
  blood: { k: 'break', dur: 4, ch: 0.4 }, ghost: { k: 'slow', dur: 2, ch: 0.5 }, water: { k: 'slow', dur: 2, ch: 0.4 }, earth: { k: 'knock', dur: 0.3, ch: 0.6 },
};

/** 地上的预警 / 持续区域 */
export interface Hz {
  k: 'circle' | 'cone' | 'line'; x: number; y: number; r: number; ang: number; spread: number; len: number; w: number;
  t: number; tele: number; dur: number; el: El; dmg: number; realm: number; status?: StatusSpec; src?: Enemy;
  fired: boolean; tick: number; pool?: number; big?: boolean; vis?: boolean; pooling?: boolean; hitDone?: boolean;
}

// ------------------------------------------------------------------ 配招
function elOf(e: Enemy): El {
  const d = e.def, fx = d.ranged?.fx;
  const m: Record<string, El> = { fireball: 'fire', flame: 'fire', icicle: 'ice', water: 'water', blood: 'blood', ghost: 'ghost', mind: 'ghost', wind: 'wind', tornado: 'wind', lightning: 'thunder', goldthunder: 'gold', vine: 'poison', needle: 'metal', rock: 'earth', sword: 'sword' };
  if (fx && m[fx]) return m[fx];
  if (d.kind === 'ghost') return d.look?.body === 'corpse' ? 'poison' : 'ghost';
  if (d.zone === 'cold') return 'ice';
  if (d.zone === 'demon' || d.evil) return 'blood';
  if (d.zone === 'sea') return 'water';
  const b = d.look?.body;
  if (b === 'spider' || b === 'scorpion' || b === 'centipede' || b === 'toad' || b === 'snake') return 'poison';
  if (b === 'corpse') return 'poison';
  return 'phys';
}

const S = (o: Partial<FoeSkill> & { id: string; name: string; k: SkKind }, el: El): FoeSkill => ({ el, cd: 7, tele: 0.8, pow: 1.8, range: 520, ...o } as FoeSkill);

function rainName(el: El) { return ({ fire: '火雨', ice: '冰锥雨', water: '水箭雨', thunder: '落雷', poison: '毒雨', blood: '血雨', ghost: '鬼火雨', wind: '风刃雨', earth: '落石', sword: '剑雨', gold: '金雷落', metal: '金针雨', phys: '落石' } as Record<El, string>)[el]; }
function breathName(el: El) { return ({ fire: '烈焰吐息', ice: '寒霜吐息', water: '水龙吐息', thunder: '雷霆吐息', poison: '毒雾喷吐', blood: '血煞喷吐', ghost: '阴风', wind: '狂风吐息', earth: '沙暴', sword: '剑气横扫', gold: '金光', metal: '金芒', phys: '咆哮' } as Record<El, string>)[el]; }

/** 按身形 + 五行配招（数量随等阶增加） */
function autoKit(e: Enemy): FoeSkill[] {
  const d = e.def, el = elOf(e), b = d.look?.body ?? (d.kind === 'human' ? 'human' : 'ghost');
  const pool: FoeSkill[] = [];
  const elN = EL_NAME[el];
  const st = EL_ST[el];
  const breath = S({ id: 'breath', name: breathName(el), k: 'cone', r: 300, spread: 0.5, tele: 0.85, pow: 2.1, range: 300, cd: 8, status: st, pool: el === 'fire' || el === 'poison' ? 3 : 0 }, el === 'phys' ? 'wind' : el);
  const rain = S({ id: 'rain', name: rainName(el), k: 'rain', n: 5, r: 85, tele: 1.0, pow: 1.7, range: 560, cd: 9, status: st, pool: el === 'poison' || el === 'fire' ? 2.5 : 0 }, el === 'phys' ? 'earth' : el);
  const salvo = S({ id: 'salvo', name: `${elN || '妖'}弹连发`, k: 'salvo', n: 3, waves: 3, spread: 0.5, tele: 0.35, pow: 0.75, range: 560, min: 140, cd: 6 }, el === 'phys' ? 'earth' : el);
  switch (b) {
    case 'wolf': case 'fox': case 'tiger': case 'deer': case 'horse': case 'rat':
      pool.push(S({ id: 'pounce', name: b === 'tiger' ? '猛虎扑杀' : '扑杀', k: 'leap', r: 95, tele: 0.75, pow: 1.9, range: 430, min: 110, cd: 6 }, 'phys'));
      pool.push(S({ id: 'claw', name: '裂爪', k: 'cone', r: 160, spread: 0.85, tele: 0.45, pow: 1.6, range: 150, cd: 5, status: { k: 'break', dur: 3, ch: 0.4 } }, 'phys'));
      if (b === 'wolf' && !d.lair) pool.push(S({ id: 'howl', name: '啸聚群狼', k: 'summon', n: 2, minion: d.id, tele: 0.8, range: 900, cd: 30, once: true, hpBelow: 0.75 }, 'phys'));
      if (b === 'tiger') pool.push(S({ id: 'roar', name: '虎啸山林', k: 'roar', r: 230, tele: 0.7, pow: 0.9, range: 230, cd: 14, status: { k: 'stun', dur: 0.8, ch: 0.6 } }, el === 'phys' ? 'wind' : el));
      if (el !== 'phys') pool.push(el === 'fire' || el === 'ice' || el === 'wind' ? breath : rain);
      break;
    case 'boar': case 'ox': case 'pangolin': case 'croc':
      pool.push(S({ id: 'charge', name: b === 'boar' ? '推山冲撞' : b === 'ox' ? '蛮牛冲阵' : '冲撞', k: 'charge', len: 560, w: 90, tele: 0.75, pow: 2.2, range: 520, min: 120, cd: 6, status: { k: 'knock', dur: 0.4, ch: 0.9 } }, 'earth'));
      pool.push(S({ id: 'stomp', name: '践踏', k: 'nova', r: 180, tele: 0.75, pow: 1.8, range: 170, cd: 7, status: { k: 'slow', dur: 2, ch: 0.6 } }, 'earth'));
      if (b === 'pangolin' || b === 'croc') pool.push(S({ id: 'guard', name: '铁甲', k: 'guard', dur: 4, tele: 0.3, range: 600, cd: 16 }, 'earth'));
      if (el !== 'phys') pool.push(el === 'wind' ? breath : rain);
      break;
    case 'snake': case 'jiao': case 'shark': case 'fish': case 'carp':
      pool.push(S({ id: 'lunge', name: '蛇吻疾噬', k: 'charge', len: 360, w: 70, tele: 0.55, pow: 1.9, range: 340, min: 90, cd: 5, status: st }, el === 'phys' ? 'poison' : el));
      pool.push(breath.el === 'wind' && el === 'phys' ? S({ ...breath, el: 'poison', name: '毒雾喷吐' }, 'poison') : breath);
      if (b === 'jiao' || e.blv >= 5) pool.push(S({ id: 'beam', name: el === 'water' ? '蛟龙水箭' : el === 'fire' ? '烈焰龙息' : el === 'blood' ? '血煞光' : el === 'gold' ? '金雷光柱' : `${elN}光`, k: 'beam', len: 680, w: 70, tele: 0.95, dur: 0.6, pow: 2.5, range: 640, min: 120, cd: 10, status: st }, el === 'phys' ? 'water' : el));
      pool.push(S({ id: 'tail', name: '神龙摆尾', k: 'nova', r: 190, tele: 0.7, pow: 1.8, range: 180, cd: 7, status: { k: 'knock', dur: 0.4, ch: 0.9 } }, el === 'phys' ? 'water' : el));
      pool.push(rain);
      break;
    case 'eagle': case 'bat':
      pool.push(S({ id: 'dive', name: '俯冲扑击', k: 'charge', len: 620, w: 80, tele: 0.65, pow: 2, range: 560, min: 100, cd: 6 }, el === 'phys' ? 'wind' : el));
      pool.push(S({ id: 'feather', name: b === 'bat' ? '血翼音刃' : '羽刃', k: 'salvo', n: 7, waves: 1, spread: 1.1, tele: 0.45, pow: 0.9, range: 560, min: 120, cd: 6 }, el === 'phys' ? 'wind' : el));
      pool.push(S({ id: 'gale', name: el === 'thunder' ? '雷暴' : '旋风', k: 'circle', r: 120, tele: 0.9, pow: 1.9, range: 520, cd: 8, status: el === 'thunder' ? EL_ST.thunder : { k: 'slow', dur: 2, ch: 0.6 }, pool: 2 }, el === 'phys' ? 'wind' : el));
      pool.push(rain.el === 'earth' ? S({ ...rain, el: 'wind', name: '风刃雨' }, 'wind') : rain);
      break;
    case 'ape': case 'bear': case 'corpse': case 'yaksha': case 'turtle':
      pool.push(S({ id: 'slam', name: b === 'turtle' ? '玄甲压顶' : '泰山压顶', k: 'leap', r: 140, tele: 0.9, pow: 2.4, range: 420, min: 100, cd: 7, status: { k: 'stun', dur: 0.6, ch: 0.5 } }, 'earth'));
      pool.push(S({ id: 'quake', name: '震地', k: 'nova', r: 230, tele: 0.95, pow: 2, range: 220, cd: 8, status: { k: 'slow', dur: 2, ch: 0.7 } }, 'earth'));
      if (b === 'turtle' || b === 'ape') pool.push(S({ id: 'guard', name: b === 'turtle' ? '龟甲护体' : '金刚护体', k: 'guard', dur: 4, tele: 0.3, range: 600, cd: 15 }, 'earth'));
      if (b === 'corpse' || b === 'yaksha') pool.push(S({ id: 'claw', name: '尸爪撕裂', k: 'cone', r: 170, spread: 0.9, tele: 0.45, pow: 1.7, range: 160, cd: 5, status: EL_ST.poison }, 'poison'));
      pool.push(S({ id: 'rocks', name: rainName(el === 'phys' ? 'earth' : el), k: 'rain', n: 5, r: 90, tele: 1.0, pow: 1.7, range: 560, cd: 9, status: EL_ST[el === 'phys' ? 'earth' : el] }, el === 'phys' ? 'earth' : el));
      break;
    case 'spider': case 'scorpion': case 'centipede': case 'ant': case 'mantis':
      if (b === 'spider') pool.push(S({ id: 'web', name: '缚灵蛛网', k: 'circle', r: 120, tele: 0.75, pow: 1.1, range: 520, cd: 8, status: { k: 'root', dur: 1.6, ch: 0.9 } }, 'poison'));
      if (b === 'scorpion') pool.push(S({ id: 'sting', name: '毒尾刺', k: 'beam', len: 300, w: 50, tele: 0.5, dur: 0.25, pow: 2.1, range: 280, cd: 5, status: EL_ST.poison }, 'poison'));
      if (b === 'centipede') pool.push(S({ id: 'rush', name: '百足疾冲', k: 'charge', len: 600, w: 80, tele: 0.6, pow: 2, range: 560, min: 100, cd: 6, status: st ?? EL_ST.poison }, el === 'phys' ? 'poison' : el));
      if (b === 'ant') pool.push(S({ id: 'swarm', name: '蚁群', k: 'summon', n: 3, minion: d.id, tele: 0.8, range: 900, cd: 25, once: true, hpBelow: 0.8 }, 'fire'));
      if (b === 'mantis') pool.push(S({ id: 'scythe', name: '双镰斩', k: 'cone', r: 190, spread: 0.7, tele: 0.4, pow: 1.5, range: 180, cd: 4, waves: 2 }, 'sword'));
      pool.push(S({ id: 'spit', name: el === 'ice' ? '冰蚕寒丝' : '毒液喷吐', k: 'salvo', n: 3, waves: 2, spread: 0.45, tele: 0.4, pow: 0.8, range: 520, min: 100, cd: 6, status: st ?? EL_ST.poison }, el === 'phys' ? 'poison' : el));
      pool.push(S({ id: 'miasma', name: el === 'ice' ? '寒雾' : '毒瘴', k: 'rain', n: 4, r: 95, tele: 1.0, pow: 1.3, range: 520, cd: 10, status: st ?? EL_ST.poison, pool: 3 }, el === 'phys' ? 'poison' : el));
      break;
    case 'toad': case 'jelly': case 'urchin':
      if (b === 'urchin') pool.push(S({ id: 'needles', name: '千目针雨', k: 'ring', n: 18, waves: 2, tele: 0.5, pow: 0.8, range: 520, cd: 6 }, 'metal'));
      else pool.push(S({ id: 'ring', name: b === 'toad' ? '毒泡' : '水泡', k: 'ring', n: 12, waves: 1, tele: 0.55, pow: 0.8, range: 480, cd: 7, status: st }, el === 'phys' ? 'poison' : el));
      pool.push(S({ id: 'tongue', name: b === 'toad' ? '长舌' : '触须', k: 'beam', len: 400, w: 40, tele: 0.5, dur: 0.25, pow: 1.6, range: 380, cd: 5, status: { k: 'slow', dur: 2, ch: 0.7 } }, el === 'phys' ? 'poison' : el));
      pool.push(rain.el === 'earth' ? S({ ...rain, el: 'poison', name: '毒雨', pool: 3 }, 'poison') : rain);
      pool.push(S({ id: 'burst', name: '爆浆', k: 'nova', r: 200, tele: 0.8, pow: 1.8, range: 190, cd: 8, status: st, pool: el === 'fire' || el === 'poison' ? 3 : 0 }, el === 'phys' ? 'poison' : el));
      break;
    case 'ghost': case 'demon':
      pool.push(S({ id: 'blink', name: d.evil ? '魔影闪' : '鬼影瞬移', k: 'blink', tele: 0.25, pow: 1.5, range: 600, min: 150, cd: 7 }, el));
      pool.push(S({ id: 'wail', name: el === 'blood' ? '血煞环' : '万鬼哭嚎', k: 'ring', n: 14, waves: 2, tele: 0.6, pow: 0.75, range: 520, cd: 8, status: st }, el));
      pool.push(S({ id: 'soul', name: el === 'blood' ? '血爆' : '摄魂', k: 'circle', r: 115, tele: 0.85, pow: 1.9, range: 520, cd: 7, status: el === 'blood' ? EL_ST.blood : { k: 'stun', dur: 0.7, ch: 0.5 } }, el));
      pool.push(S({ id: 'call', name: '招魂', k: 'summon', n: 2, minion: 'yinhun', tele: 0.9, range: 900, cd: 30, once: true, hpBelow: 0.7 }, 'ghost'));
      pool.push(rain);
      break;
    default: break;
  }
  // 招式不足三式的，补上妖啸 / 天降之术
  if (pool.length < 3 && !pool.some((s) => s.id === 'roar')) pool.push(S({ id: 'roar', name: '妖啸', k: 'roar', r: 220, tele: 0.7, pow: 0.8, range: 220, cd: 14, status: { k: 'stun', dur: 0.6, ch: 0.5 } }, el === 'phys' ? 'wind' : el));
  if (pool.length < 4 && !pool.some((s) => s.k === 'rain')) pool.push(rain);
  return pool;
}

/** 修士：照着法术库出招，境界越高招越多，结丹以上祭出法宝 */
function humanKit(e: Enemy): FoeSkill[] {
  const el = elOf(e), r = e.realm, out: FoeSkill[] = [];
  const evil = !!e.def.evil;
  if (el === 'fire') { out.push(S({ id: 'h_fire', name: '火弹术·连发', k: 'salvo', n: 1, waves: 4, spread: 0.12, tele: 0.3, pow: 0.9, range: 560, min: 120, cd: 5 }, 'fire')); out.push(S({ id: 'h_firerain', name: '火雨符', k: 'rain', n: 5, r: 85, tele: 1.0, pow: 1.7, range: 560, cd: 9, status: EL_ST.fire, pool: 2.5 }, 'fire')); }
  else if (el === 'sword') { out.push(S({ id: 'h_qi', name: '剑芒', k: 'beam', len: 560, w: 46, tele: 0.6, dur: 0.3, pow: 2.1, range: 540, min: 100, cd: 6 }, 'sword')); out.push(S({ id: 'h_fly', name: '御剑三连斩', k: 'salvo', n: 3, waves: 2, spread: 0.3, tele: 0.35, pow: 0.9, range: 560, min: 120, cd: 6 }, 'sword')); }
  else if (el === 'blood') { out.push(S({ id: 'h_claw', name: '血魔爪', k: 'cone', r: 220, spread: 0.75, tele: 0.55, pow: 1.9, range: 210, cd: 5, status: EL_ST.blood }, 'blood')); out.push(S({ id: 'h_bblink', name: '血影遁', k: 'blink', tele: 0.25, pow: 1.4, range: 620, min: 160, cd: 7 }, 'blood')); out.push(S({ id: 'h_bmist', name: '血雾', k: 'circle', r: 130, tele: 0.85, pow: 1.5, range: 520, cd: 9, status: EL_ST.blood, pool: 3 }, 'blood')); }
  else if (el === 'metal') { out.push(S({ id: 'h_needle', name: '暴雨梨花针', k: 'salvo', n: 9, waves: 1, spread: 0.9, tele: 0.45, pow: 0.6, range: 520, min: 100, cd: 6, status: EL_ST.poison }, 'metal')); }
  else if (el === 'ghost') { out.push(S({ id: 'h_soul', name: '摄魂术', k: 'circle', r: 110, tele: 0.85, pow: 1.8, range: 520, cd: 7, status: { k: 'stun', dur: 0.7, ch: 0.5 } }, 'ghost')); }
  // 人人会用的符箓：雷符 / 冰符
  const ice = Math.random() < 0.5;
  out.push(S({ id: 'h_talis', name: ice ? '寒冰符' : '引雷符', k: 'circle', r: 105, tele: 0.85, pow: 2, range: 560, cd: 8, status: ice ? EL_ST.ice : EL_ST.thunder }, ice ? 'ice' : 'thunder'));
  if (r >= 2) out.push(S({ id: 'h_guard', name: '护体灵光', k: 'guard', dur: 4, tele: 0.3, range: 700, cd: 16 }, 'gold'));
  out.push(S({ id: 'h_pill', name: '服下回春丹', k: 'heal', tele: 0.4, range: 2000, cd: 60, once: true, hpBelow: 0.4 }, 'poison'));
  if (r >= 2) out.push(S({ id: 'h_rain', name: evil ? '血剑雨' : '剑雨', k: 'rain', n: 6, r: 80, tele: 1.0, pow: 1.6, range: 560, cd: 10 }, evil ? 'blood' : 'sword'));
  if (r >= 3) out.push(S({ id: 'h_big', name: evil ? '法宝·血河幡' : '法宝·巨剑斩', k: 'beam', len: 760, w: 120, tele: 1.1, dur: 0.5, pow: 3.2, range: 720, min: 120, cd: 14, ult: true }, evil ? 'blood' : 'gold'));
  if (r >= 3 && evil) out.push(S({ id: 'h_corpse', name: '驭尸', k: 'summon', n: 2, minion: 'lianshi', tele: 1, range: 900, cd: 40, once: true, hpBelow: 0.7 }, 'poison'));
  return out;
}

/** 第三十二步：追杀者另带困灵阵、定身符——专门留人 */
export function pursuerKit(e: Enemy): FoeSkill[] {
  const out = humanKit(e).filter((s) => s.id !== 'h_bblink');
  out.push(S({ id: 'p_trap', name: '困灵阵', k: 'circle', r: 150, tele: 0.75, pow: 1.2, range: 620, cd: 11, status: { k: 'root', dur: 1.6, ch: 0.85 }, pool: 2.5 }, 'earth'));
  out.push(S({ id: 'p_seal', name: '定身符', k: 'salvo', n: 3, waves: 1, spread: 0.35, tele: 0.35, pow: 0.7, range: 640, min: 120, cd: 9, status: { k: 'stun', dur: 0.6, ch: 0.45 } }, 'gold'));
  return out;
}

/** 原著妖王 / 魔物：专属招式与大招 */
const LAIR_KIT: Record<string, (e: Enemy) => FoeSkill[]> = {
  mojiao: () => [
    S({ id: 'mj_water', name: '腐水喷吐', k: 'cone', r: 330, spread: 0.55, tele: 0.85, pow: 2.1, range: 320, cd: 7, status: EL_ST.poison, pool: 3.5 }, 'poison'),
    S({ id: 'mj_rain', name: '紫毒雨', k: 'rain', n: 7, r: 90, tele: 1.05, pow: 1.7, range: 600, cd: 9, status: EL_ST.poison, pool: 3 }, 'poison'),
    S({ id: 'mj_tail', name: '墨蛟摆尾', k: 'nova', r: 220, tele: 0.75, pow: 1.9, range: 210, cd: 7, status: { k: 'knock', dur: 0.4, ch: 0.9 } }, 'water'),
    S({ id: 'mj_ult', name: '墨蛟翻江', k: 'beam', len: 800, w: 110, tele: 1.2, dur: 0.8, pow: 3, range: 760, cd: 16, ult: true, status: EL_ST.poison }, 'water'),
  ],
  gumo_xueyan: () => [
    S({ id: 'gm_rain', name: '血焰天降', k: 'rain', n: 9, r: 100, tele: 1.0, pow: 2, range: 660, cd: 8, status: EL_ST.fire, pool: 3 }, 'blood'),
    S({ id: 'gm_beam', name: '血焰柱', k: 'beam', len: 820, w: 120, tele: 1.0, dur: 0.7, pow: 2.8, range: 760, cd: 9 }, 'blood'),
    S({ id: 'gm_ring', name: '魔焰环', k: 'ring', n: 22, waves: 3, tele: 0.7, pow: 0.9, range: 600, cd: 9 }, 'blood'),
    S({ id: 'gm_blink', name: '魔影闪', k: 'blink', tele: 0.25, pow: 1.8, range: 700, min: 160, cd: 7 }, 'blood'),
    S({ id: 'gm_call', name: '召唤魔物', k: 'summon', n: 3, minion: 'zhenmo', tele: 1, range: 900, cd: 40, once: true, hpBelow: 0.6 }, 'blood'),
    S({ id: 'gm_ult', name: '血焰焚天', k: 'nova', r: 420, tele: 1.6, pow: 3.6, range: 420, cd: 18, ult: true, status: EL_ST.fire, pool: 3 }, 'blood'),
  ],
  yinchi: () => [
    S({ id: 'yc_dive', name: '银翅俯冲', k: 'charge', len: 700, w: 100, tele: 0.6, pow: 2.3, range: 640, min: 100, cd: 5 }, 'wind'),
    S({ id: 'yc_feather', name: '银羽风刃', k: 'ring', n: 18, waves: 2, tele: 0.55, pow: 0.9, range: 560, cd: 7 }, 'wind'),
    S({ id: 'yc_leap', name: '夜叉扑杀', k: 'leap', r: 130, tele: 0.8, pow: 2.4, range: 480, min: 100, cd: 6 }, 'phys'),
    S({ id: 'yc_ult', name: '银翅风暴', k: 'rain', n: 12, r: 110, tele: 1.2, pow: 2.2, range: 700, cd: 16, ult: true, status: { k: 'slow', dur: 2, ch: 0.7 }, pool: 2 }, 'wind'),
  ],
  dujiao: () => [
    S({ id: 'dj_breath', name: '毒煞吐息', k: 'cone', r: 340, spread: 0.55, tele: 0.85, pow: 2.2, range: 330, cd: 7, status: EL_ST.poison, pool: 3 }, 'poison'),
    S({ id: 'dj_beam', name: '血毒光', k: 'beam', len: 760, w: 90, tele: 0.95, dur: 0.6, pow: 2.6, range: 720, cd: 9, status: EL_ST.poison }, 'blood'),
    S({ id: 'dj_tail', name: '摆尾', k: 'nova', r: 220, tele: 0.75, pow: 2, range: 210, cd: 7 }, 'poison'),
    S({ id: 'dj_ult', name: '万毒蚀天', k: 'rain', n: 12, r: 105, tele: 1.2, pow: 2.2, range: 700, cd: 16, ult: true, status: EL_ST.poison, pool: 4 }, 'poison'),
  ],
  shuanggong: () => [
    S({ id: 'sg_breath', name: '极寒毒液', k: 'cone', r: 340, spread: 0.55, tele: 0.8, pow: 2.2, range: 330, cd: 6, status: { k: 'freeze', dur: 1.2, ch: 0.5 } }, 'ice'),
    S({ id: 'sg_rush', name: '六翼疾掠', k: 'charge', len: 720, w: 100, tele: 0.55, pow: 2.3, range: 680, min: 100, cd: 5 }, 'ice'),
    S({ id: 'sg_rain', name: '冰锥雨', k: 'rain', n: 9, r: 95, tele: 1.0, pow: 1.9, range: 640, cd: 9, status: EL_ST.ice }, 'ice'),
    S({ id: 'sg_ult', name: '冰封千里', k: 'nova', r: 440, tele: 1.6, pow: 3.4, range: 440, cd: 18, ult: true, status: { k: 'freeze', dur: 1.5, ch: 0.8 } }, 'ice'),
  ],
  fengxi: () => [
    S({ id: 'fx_gale', name: '裂风旋', k: 'rain', n: 7, r: 110, tele: 1.0, pow: 2, range: 640, cd: 8, status: { k: 'slow', dur: 2, ch: 0.7 }, pool: 2 }, 'wind'),
    S({ id: 'fx_blades', name: '风刃', k: 'ring', n: 20, waves: 2, tele: 0.55, pow: 0.9, range: 600, cd: 7 }, 'wind'),
    S({ id: 'fx_dive', name: '裂风扑击', k: 'charge', len: 760, w: 110, tele: 0.55, pow: 2.4, range: 700, min: 100, cd: 5 }, 'wind'),
    S({ id: 'fx_ult', name: '裂空风刃', k: 'beam', len: 900, w: 150, tele: 1.3, dur: 0.8, pow: 3.4, range: 860, cd: 16, ult: true }, 'wind'),
  ],
};

/** 首领通用大招 */
function ultFor(el: El, e: Enemy): FoeSkill {
  const n = EL_NAME[el] || '妖';
  return Math.random() < 0.5
    ? S({ id: 'ult', name: `${n}灾·天降`, k: 'rain', n: 11, r: 105, tele: 1.2, pow: 2.2, range: 700, cd: 18, ult: true, status: EL_ST[el], pool: el === 'fire' || el === 'poison' ? 3 : 0 }, el === 'phys' ? 'earth' : el)
    : S({ id: 'ult', name: `${n}煞爆`, k: 'nova', r: 400, tele: 1.5, pow: 3.2, range: 400, cd: 18, ult: true, status: EL_ST[el] }, el === 'phys' ? 'earth' : el);
}

export function isBoss(e: Enemy) { return !!(e.boss || e.def.lair || e.blv >= 8); }

export function kitOf(e: Enemy): FoeSkill[] {
  if (e.kit) return e.kit;
  let kit: FoeSkill[];
  if (LAIR_KIT[e.def.id]) kit = LAIR_KIT[e.def.id](e);
  else if (e.def.kind === 'human') kit = humanKit(e);
  else {
    const all = autoKit(e);
    const tier = e.blv || Math.max(1, e.realm * 2 - 1);
    const n = tier <= 4 ? 3 : 4;
    // 先保留召唤/护体这类“一次性”招，其余按顺序取
    kit = all.slice(0, n);
    if (isBoss(e)) kit.push(ultFor(elOf(e), e));
  }
  // 见人就逃 / 不主动伤人的小兽不配招
  if (e.def.behave === 'flee' || e.def.behave === 'shy') kit = [];
  e.kit = kit;
  return kit;
}

// ------------------------------------------------------------------ 运行
type Cast = { sk: FoeSkill; t: number; x0: number; y0: number; x1: number; y1: number; ang: number; hit: boolean; wave: number; hz?: Hz; dash?: number };

export class FoeAI {
  c: Combat;
  hz: Hz[] = [];
  private pend: Hz[] = [];
  /** 大招结算后的全屏闪光（秒）与颜色 */
  ultFlash = 0; ultCol = '255,255,255';
  /** 当前蓄力中的大招进度（0 = 无），供全屏压暗 */
  ultCharge() { let u = 0; for (const h of this.hz) if (h.big && !h.fired) u = Math.max(u, h.t / h.tele); return u; }
  constructor(c: Combat) { this.c = c; }
  reset() { this.hz = []; }

  /** 阶段狂暴：血量跌破 70% / 35% */
  phase(e: Enemy) {
    if (!isBoss(e) || e.dead) return;
    const k = e.hp / e.maxHp, want = k < 0.35 ? 2 : k < 0.7 ? 1 : 0;
    if (want <= e.rage) return;
    e.rage = want;
    const c = this.c, g = c.game;
    c.texts.push({ x: e.x, y: e.y - 150, s: want === 2 ? `${e.name}·狂暴！` : `${e.name}·暴怒！`, color: '#ff5a3a', t: 0, vy: -20, big: true });
    g.toast(want === 2 ? `${e.name}血气翻涌，彻底狂暴了——招式更快、更狠！` : `${e.name}被激怒了，周身${EL_NAME[elOf(e)] || '妖'}气暴涨！`, 'warn');
    g.juice(0.08, 0.6);
    c.vfx.push({ kind: 'ring', x: e.x, y: e.y, r: 320, t: 0, dur: 0.7, color: EL_COL[elOf(e)], fx: 'roar' } as any);
    c.fxq.push({ k: 'kill', x: e.x, y: e.y - 60, color: EL_COL[elOf(e)] });
    // 震退
    const p = g.player, dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1;
    if (d < 320) { p.x += dx / d * 90; p.y += dy / d * 50; }
    // 立刻放大招
    const u = kitOf(e).find((s) => s.ult); if (u) e.skCd[u.id] = 0.6;
    e.skT = Math.min(e.skT, 0.8);
    audio.sfx('thunder');
  }

  /** 每帧：处于施法中则推进，返回 true 表示此敌人本帧由技能接管（不再走寻常 AI） */
  tick(e: Enemy, dt: number, tx: number, ty: number, dist: number): boolean {
    const kit = kitOf(e);
    if (!kit.length) return false;
    for (const k in e.skCd) e.skCd[k] -= dt * (1 + e.rage * 0.25);
    e.guardT = Math.max(0, e.guardT - dt);
    if (e.cast) { this.run(e, e.cast, dt, tx, ty); return true; }
    e.skT -= dt * (1 + e.rage * 0.35);
    if (e.skT > 0 || e.windup > 0) return false;
    const hpK = e.hp / e.maxHp;
    const ready = kit.filter((s) => (e.skCd[s.id] ?? 0) <= 0 && dist <= s.range && dist >= (s.min ?? 0) && (!s.hpBelow || hpK < s.hpBelow) && !(s.once && e.used?.[s.id]));
    if (!ready.length) { e.skT = 0.4; return false; }
    // 大招优先；其余随机
    const sk = ready.find((s) => s.ult) ?? ready[Math.floor(Math.random() * ready.length)];
    this.start(e, sk, tx, ty);
    return true;
  }

  private start(e: Enemy, sk: FoeSkill, tx: number, ty: number) {
    const c = this.c, g = c.game;
    e.skCd[sk.id] = sk.cd * rand(0.9, 1.15);
    e.skT = (isBoss(e) ? 1.6 : 2.6) * rand(0.8, 1.3);
    if (sk.once) (e.used ??= {})[sk.id] = true;
    const ang = Math.atan2(ty - e.y, tx - e.x);
    const cast: Cast = { sk, t: 0, x0: e.x, y0: e.y, x1: tx, y1: ty, ang, hit: false, wave: 0 };
    e.cast = cast; e.facing = tx > e.x ? 1 : -1;
    e.anim.atk = 0.3;
    c.texts.push({ x: e.x, y: e.y - (e.def.kind === 'human' ? 135 : 120), s: sk.name, color: sk.ult ? '#ffcf5a' : '#ffb08a', t: 0, vy: -18, big: !!sk.ult });
    if (sk.ult) { g.juice(0.02, 0.25); g.toast(`${e.name}施展「${sk.name}」！`, 'warn'); }
    const dmg = e.atk * sk.pow * (1 + e.rage * 0.15);
    const base = { t: 0, tele: sk.tele, dur: 0, el: sk.el, dmg, realm: e.realm, status: sk.status, src: e, fired: false, tick: 0, pool: sk.pool, big: !!sk.ult, spread: 0, len: 0, w: 0, ang: 0, r: 0 };
    switch (sk.k) {
      case 'circle': { const lead = 0.35 + (e.def.kind === 'human' || e.blv >= 4 ? 0.35 : 0); const p = g.player; const vx = p.st?.vx ?? 0, vy = p.st?.vy ?? 0; this.add({ ...base, k: 'circle', x: tx + vx * lead * 0.5, y: ty + vy * lead * 0.5, r: sk.r! }); break; }
      case 'rain': {
        const n = sk.n! + e.rage * 2;
        for (let i = 0; i < n; i++) {
          const a = Math.random() * TAU, rr = i === 0 ? 0 : rand(60, 260 + (sk.ult ? 140 : 0));
          this.add({ ...base, k: 'circle', x: tx + Math.cos(a) * rr, y: ty + Math.sin(a) * rr * 0.7, r: sk.r! * rand(0.85, 1.15), tele: sk.tele + i * 0.12, big: false, pool: sk.pool && i % 2 === 0 ? sk.pool : 0 });
        }
        break;
      }
      case 'cone': cast.hz = this.add({ ...base, k: 'cone', x: e.x, y: e.y, r: sk.r!, spread: sk.spread!, ang }); break;
      case 'nova': case 'roar': cast.hz = this.add({ ...base, k: 'circle', x: e.x, y: e.y, r: sk.r! }); break;
      case 'beam': cast.hz = this.add({ ...base, k: 'line', x: e.x, y: e.y - 20, ang, len: sk.len!, w: sk.w!, dur: sk.dur ?? 0.5 }); break;
      case 'leap': {
        const T = g.terrain, ok = (x: number, y: number) => e.def.flying || (e.sea ? !T.isLand(x, y) : T.walkFactor(x, y) > 0);
        let d = Math.min(Math.hypot(tx - e.x, ty - e.y), sk.range);
        while (d > 40 && !ok(e.x + Math.cos(ang) * d, e.y + Math.sin(ang) * d)) d -= 40;
        cast.x1 = e.x + Math.cos(ang) * d; cast.y1 = e.y + Math.sin(ang) * d; cast.hz = this.add({ ...base, k: 'circle', x: cast.x1, y: cast.y1, r: sk.r! }); break; }
      case 'charge': { const L = sk.len!; cast.x1 = e.x + Math.cos(ang) * L; cast.y1 = e.y + Math.sin(ang) * L; cast.hz = this.add({ ...base, k: 'line', x: e.x, y: e.y, ang, len: L, w: sk.w!, dmg: 0 }); cast.hz.vis = true; break; }
      default: break;
    }
  }

  private add(h: Hz) { this.hz.push(h); return h; }
  /** 第三十二步：土遁伏击等“非招式”的地面预警 */
  zone(e: Enemy, x: number, y: number, r: number, el: El, pow: number, tele: number, status?: StatusSpec) {
    return this.add({ k: 'circle', x, y, r, t: 0, tele, dur: 0, el, dmg: e.atk * pow, realm: e.realm, status, src: e, fired: false, tick: 0, spread: 0, len: 0, w: 0, ang: 0 });
  }

  private run(e: Enemy, cs: Cast, dt: number, tx: number, ty: number) {
    const c = this.c, g = c.game, sk = cs.sk, T = g.terrain;
    cs.t += dt;
    const u = cs.t / sk.tele;
    e.anim.atk = Math.min(1, 0.3 + u * 0.7);
    if (e.st.freeze || e.st.stun) { this.interrupt(e); return; }
    switch (sk.k) {
      case 'salvo': case 'ring': {
        if (cs.t < sk.tele) return;
        const waves = sk.waves ?? 1, gap = sk.k === 'ring' ? 0.32 : 0.16;
        while (cs.wave < waves && cs.t >= sk.tele + cs.wave * gap) { this.fireWave(e, sk, cs, tx, ty); cs.wave++; }
        if (cs.wave >= waves) this.end(e);
        return;
      }
      case 'leap': {
        const crouch = 0.35;
        if (u < crouch) return;
        const k = Math.min(1, (u - crouch) / (1 - crouch));
        e.x = cs.x0 + (cs.x1 - cs.x0) * k; e.y = cs.y0 + (cs.y1 - cs.y0) * k;
        e.lift = Math.sin(k * Math.PI) * (140 + (sk.r ?? 100) * 0.4);
        if (u >= 1) { e.lift = 0; this.end(e); }
        return;
      }
      case 'charge': {
        if (u < 1) return;
        cs.dash = (cs.dash ?? 0) + dt;
        const spd = 1500, L = sk.len!, k = Math.min(1, cs.dash * spd / L);
        const px = e.x, py = e.y, nx = cs.x0 + (cs.x1 - cs.x0) * k, ny = cs.y0 + (cs.y1 - cs.y0) * k;
        const okMove = e.def.flying || (e.sea ? !T.isLand(nx, ny) : T.walkFactor(nx, ny) > 0);
        if (okMove) { e.x = nx; e.y = ny; }
        if (Math.random() < 0.8) c.sparks.push({ x: px, y: e.y - 20, vx: -Math.cos(cs.ang) * 120, vy: -40, t: 0, max: 0.4, size: 5, color: EL_COL[sk.el] });
        const p = g.player;
        if (!cs.hit) for (const t of c.tanks) if (t.k !== 'p' && t.k !== 'decoy' && Math.hypot(t.x - e.x, t.y - e.y) < 70 + (sk.w ?? 80) * 0.3) { cs.hit = true; c.tankHit(t, e.atk * sk.pow * (1 + e.rage * 0.15), e.realm, sk.status, e.x, e.y); break; }
        if (!cs.hit && Math.hypot(p.x - e.x, p.y - e.y) < 70 + (sk.w ?? 80) * 0.3) {
          cs.hit = true;
          c.hitPlayer(e.atk * sk.pow * (1 + e.rage * 0.15), e.realm, sk.status, e.x, e.y, e);
          const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1; p.x += dx / d * 70 + Math.cos(cs.ang) * 40; p.y += dy / d * 40;
          g.juice(0.05, 0.4);
          c.fxq.push({ k: 'hit', x: p.x, y: p.y - 50, color: EL_COL[sk.el], power: 2, dir: cs.ang });
        }
        if (k >= 1 || !okMove) { void py; if (cs.hz) cs.hz.t = 99; this.end(e); c.vfx.push({ kind: 'ring', x: e.x, y: e.y, r: 110, t: 0, dur: 0.4, color: EL_COL[sk.el], fx: 'rock' } as any); }
        return;
      }
      case 'blink': {
        if (cs.t < sk.tele) return;
        const p = g.player, a = Math.random() * TAU;
        c.vfx.push({ kind: 'blinkfx', x: e.x, y: e.y, r: 70, t: 0, dur: 0.45, color: EL_COL[sk.el] } as any);
        const nx = p.x + Math.cos(a) * 110, ny = p.y + Math.sin(a) * 70;
        if (e.def.flying || (e.sea ? !T.isLand(nx, ny) : T.walkFactor(nx, ny) > 0)) { e.x = nx; e.y = ny; }
        c.vfx.push({ kind: 'blinkfx', x: e.x, y: e.y, r: 70, t: 0, dur: 0.45, color: EL_COL[sk.el] } as any);
        // 现身即一爪
        const ang = Math.atan2(p.y - e.y, p.x - e.x);
        this.add({ k: 'cone', x: e.x, y: e.y, r: 190, spread: 0.8, ang, t: 0, tele: 0.42, dur: 0, el: sk.el, dmg: e.atk * sk.pow, realm: e.realm, status: sk.status, src: e, fired: false, tick: 0, len: 0, w: 0 });
        e.skT = Math.max(e.skT, 1); this.end(e); e.cast = { sk: { ...sk, k: 'nova', tele: 0.42 }, t: 0, x0: e.x, y0: e.y, x1: e.x, y1: e.y, ang, hit: false, wave: 0 } as any;
        return;
      }
      case 'summon': {
        if (cs.t < sk.tele) return;
        const def = ENEMIES[sk.minion!] ?? e.def, n = sk.n ?? 2;
        let made = 0;
        for (let i = 0; i < n; i++) {
          if (c.enemies.filter((o) => !o.dead).length >= 14) break;
          const a = (i / n) * TAU + Math.random(), x = e.x + Math.cos(a) * 120, y = e.y + Math.sin(a) * 80;
          if (!def.flying && (e.sea ? T.isLand(x, y) : T.walkFactor(x, y) <= 0)) continue;
          const m = c.makeMinion(def, x, y, e);
          c.vfx.push({ kind: 'blinkfx', x, y, r: 60, t: 0, dur: 0.5, color: EL_COL[sk.el] } as any);
          if (m) made++;
        }
        if (made) c.texts.push({ x: e.x, y: e.y - 150, s: `援兵 ×${made}`, color: '#ffb080', t: 0, vy: -24 });
        this.end(e); return;
      }
      case 'guard': {
        if (cs.t < sk.tele) return;
        e.guardT = sk.dur ?? 4;
        c.vfx.push({ kind: 'aura', x: e.x, y: e.y, r: 80, t: 0, dur: 0.6, color: EL_COL[sk.el], fx: 'gold' } as any);
        this.end(e); return;
      }
      case 'heal': {
        if (cs.t < sk.tele) return;
        e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.3);
        c.vfx.push({ kind: 'aura', x: e.x, y: e.y, r: 70, t: 0, dur: 0.7, color: '140,230,120', fx: 'leaf' } as any);
        c.texts.push({ x: e.x, y: e.y - 120, s: '+' + Math.round(e.maxHp * 0.3), color: '#8fe08a', t: 0, vy: -40 });
        this.end(e); return;
      }
      default: {
        // circle / rain：出完手即可走动；cone / nova / beam：须站定到结算
        const hold = sk.k === 'cone' || sk.k === 'nova' || sk.k === 'roar' || sk.k === 'beam';
        const end = hold ? sk.tele + (sk.k === 'beam' ? (sk.dur ?? 0.5) : 0.15) : 0.45;
        if (cs.t >= end) this.end(e);
        return;
      }
    }
  }

  /** 被冻住 / 定身：打断施法，未结算的预警作废 */
  interrupt(e: Enemy) {
    const cs = e.cast as Cast | null; if (!cs) return;
    if (cs.hz && !cs.hz.fired) { cs.hz.dmg = 0; cs.hz.t = 99; }
    this.end(e);
    this.c.texts.push({ x: e.x, y: e.y - 120, s: '打断！', color: '#bfe0ff', t: 0, vy: -30 });
  }

  private end(e: Enemy) { e.cast = null; e.lift = 0; e.anim.atk = 0; }

  private fireWave(e: Enemy, sk: FoeSkill, cs: Cast, tx: number, ty: number) {
    const c = this.c, fx = EL_PROJ[sk.el], col = EL_COL[sk.el];
    const sy = e.y - (e.anim.flying ? 70 : 40);
    const dmg = e.atk * sk.pow * (1 + e.rage * 0.15);
    const push = (ang: number, spd: number) => c.projs.push({ fac: 'e', x: e.x, y: sy, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, life: 0, max: sk.range / spd + 0.3, fx, color: col, dmg, realm: e.realm, status: sk.status ?? EL_ST[sk.el], stCh: (sk.status ?? EL_ST[sk.el])?.ch ?? 0, pierce: false, homing: false, hit: new Set(), r: 24, aoe: 0, size: sk.ult ? 1.3 : 1, trail: [], lv: 0 } as any);
    if (sk.k === 'ring') {
      const n = sk.n! + e.rage * 4, off = cs.wave * (Math.PI / n);
      for (let i = 0; i < n; i++) push(off + (i / n) * TAU, 340);
    } else {
      const n = sk.n!, aim = Math.atan2(ty - 40 - sy, tx - e.x) + (cs.wave % 2 ? 0.06 : -0.06);
      for (let i = 0; i < n; i++) push(aim + (n > 1 ? (i / (n - 1) - 0.5) * sk.spread! : 0), 560);
    }
  }

  /** 预警结算、持续区域伤害 */
  update(dt: number) {
    const c = this.c, g = c.game, p = g.player;
    this.pend = [];
    this.hz = this.hz.filter((h) => {
      h.t += dt;
      // 发招者死了：未结算的预警作废
      if (!h.fired && h.src?.dead) return false;
      if (h.k === 'cone' && !h.fired && h.src && !h.src.dead) { h.x = h.src.x; h.y = h.src.y; }
      if (!h.fired && h.t >= h.tele) {
        h.fired = true;
        if (h.dmg > 0) {
          if (this.inside(h, p.x, p.y)) { c.hitPlayer(h.dmg, h.realm, h.status, h.x, h.y, h.src); h.hitDone = true; }
          for (const t of c.tanks) if (t.k !== 'p' && t.k !== 'decoy' && this.inside(h, t.x, t.y)) c.tankHit(t, h.dmg, h.realm, h.status, h.x, h.y);
          this.boom(h);
        }
      }
      // 光柱：持续时间内反复判定
      if (h.fired && h.k === 'line' && h.dur > 0 && h.dmg > 0 && h.t < h.tele + h.dur) {
        h.tick -= dt;
        if (h.tick <= 0) { h.tick = 0.25; if (!h.hitDone && this.inside(h, p.x, p.y)) { c.hitPlayer(h.dmg * 0.5, h.realm, h.status, h.x, h.y, h.src); h.hitDone = true; } }
      }
      // 余毒 / 余火：留在地上的区域
      if (h.fired && h.pool && h.dmg > 0 && h.k === 'circle') {
        h.pooling = true;
        h.tick -= dt;
        if (h.tick <= 0) { h.tick = 0.5; if (this.inside(h, p.x, p.y)) c.hitPlayer(h.dmg * 0.18, h.realm, h.status, h.x, h.y, h.src); for (const t of c.tanks) if (t.k !== 'p' && t.k !== 'decoy' && this.inside(h, t.x, t.y)) c.tankHit(t, h.dmg * 0.18, h.realm, h.status, h.x, h.y); }
        return h.t < h.tele + h.pool;
      }
      return h.t < h.tele + Math.max(0.35, h.k === 'line' ? h.dur + 0.2 : 0.35);
    });
    if (this.pend.length) { this.hz.push(...this.pend); this.pend = []; }
    this.ultFlash = Math.max(0, this.ultFlash - dt);
  }

  inside(h: Hz, x: number, y: number) {
    if (h.k === 'circle') { const dx = (x - h.x) / h.r, dy = (y - h.y) / (h.r * 0.55); return dx * dx + dy * dy < 1; }
    if (h.k === 'cone') {
      const dx = x - h.x, dy = (y - h.y) / 0.7, d = Math.hypot(dx, dy); if (d > h.r + 20) return false;
      let da = Math.atan2(dy, dx) - Math.atan2(Math.sin(h.ang) / 0.7, Math.cos(h.ang)); while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU;
      return Math.abs(da) < h.spread || d < 40;
    }
    const ux = Math.cos(h.ang), uy = Math.sin(h.ang), dx = x - h.x, dy = y - 20 - h.y;
    const along = dx * ux + dy * uy, perp = Math.abs(-dx * uy + dy * ux);
    return along > -30 && along < h.len && perp < h.w / 2 + 18;
  }

  /** 结算瞬间的爆开：复用法术光效 + 震屏 */
  private boom(h: Hz) {
    const c = this.c, g = c.game, col = EL_COL[h.el], fx = EL_BOOM[h.el];
    const p = g.player, near = Math.hypot(p.x - h.x, p.y - h.y) < 700;
    if (h.k === 'circle') {
      if (h.el === 'thunder' || h.el === 'gold') c.vfx.push({ kind: 'strike', x: h.x, y: h.y, r: h.r, t: 0, dur: 0.5, color: col, fx: h.el === 'gold' ? 'goldthunder' : 'lightning', seed: Math.random() * 100 } as any);
      else if (h.el === 'fire' || h.el === 'blood') c.vfx.push({ kind: 'strike', x: h.x, y: h.y, r: h.r, t: 0, dur: 0.55, color: col, fx: 'flame', seed: Math.random() * 100 } as any);
      else if (h.el === 'ice') c.vfx.push({ kind: 'strike', x: h.x, y: h.y, r: h.r, t: 0, dur: 0.7, color: col, fx: 'frost', seed: Math.random() * 100 } as any);
      else if (h.el === 'earth' || h.el === 'phys') c.vfx.push({ kind: 'strike', x: h.x, y: h.y, r: h.r, t: 0, dur: 0.7, color: col, fx: 'rock', seed: Math.random() * 100 } as any);
      c.vfx.push({ kind: 'ring', x: h.x, y: h.y, r: h.r * 1.1, t: 0, dur: 0.45, color: col, fx } as any);
      c.vfx.push({ kind: 'flash', x: h.x, y: h.y - 30, r: h.r * 0.8, t: 0, dur: 0.35, color: col, fx, seed: Math.random() * 6 } as any);
      if (h.el === 'thunder' || h.el === 'gold') audio.sfx('thunder'); else if (h.big || h.r > 150) audio.sfx('boom');
    } else if (h.k === 'cone') {
      c.vfx.push({ kind: 'cone', x: h.x, y: h.y - 30, r: h.r, ang: h.ang, spread: h.spread, t: 0, dur: 0.45, color: col, fx: h.el === 'fire' ? 'flame' : h.el === 'sword' || h.el === 'phys' ? 'sword' : fx } as any);
      if (h.pool) for (let i = 0; i < 3; i++) { const a = h.ang + (i - 1) * h.spread * 0.6, d = h.r * 0.6; this.pend.push({ ...h, k: 'circle', x: h.x + Math.cos(a) * d, y: h.y + Math.sin(a) * d * 0.7, r: h.r * 0.28, t: h.tele, fired: true, tick: 0.3, pool: h.pool, dmg: h.dmg }); }
    } else {
      c.vfx.push({ kind: 'beam', x: h.x, y: h.y - 20, x2: h.x + Math.cos(h.ang) * h.len, y2: h.y - 20 + Math.sin(h.ang) * h.len, r: h.w * 0.5, t: 0, dur: Math.max(0.35, h.dur + 0.15), color: col, fx: h.el === 'thunder' ? 'lightning' : h.el === 'gold' ? 'goldthunder' : h.el === 'earth' ? 'rock' : fx, seed: Math.random() * 100 } as any);
      audio.sfx(h.big ? 'boom' : 'whoosh');
    }
    if (near) g.juice(h.big ? 0.06 : 0.015, h.big ? 0.55 : Math.min(0.3, 0.08 + h.r / 900));
    if (h.big) { (c as any).fxShock = { x: h.x, y: h.y, r: Math.max(h.r, h.len) * 1.4 }; this.ultFlash = 0.35; this.ultCol = col; if (near) g.slowmo(0.4); }
  }
}
