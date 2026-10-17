// 第三十五步：修士流派 —— 各宗门 / 散修 / 劫修的功法套路（多系、按境界解锁、首招为招牌）
// 敌方修士据其门派（NPC 的 sect、追杀者的势力，或按所在地区掷出）配招，同境界的两个门派打起来手感完全不同。
import type { Enemy } from './combat';
import type { FoeSkill, SkKind, El } from './foeskills';
import type { StatusSpec } from '../data/arts';
import { ACTIVE_MAP } from '../data/world';

const S = (o: Partial<FoeSkill> & { id: string; name: string; k: SkKind }, el: El): FoeSkill => ({ el, cd: 7, tele: 0.8, pow: 1.8, range: 520, ...o } as FoeSkill);
const ST: Record<string, StatusSpec> = {
  burn: { k: 'burn', dur: 3, ch: 0.5 }, slow: { k: 'slow', dur: 2.5, ch: 0.6 }, freeze: { k: 'freeze', dur: 1.2, ch: 0.5 }, shock: { k: 'shock', dur: 0.8, ch: 0.45 },
  poison: { k: 'poison', dur: 5, ch: 0.7 }, root: { k: 'root', dur: 1.5, ch: 0.85 }, stun: { k: 'stun', dur: 0.7, ch: 0.5 }, break: { k: 'break', dur: 4, ch: 0.5 }, knock: { k: 'knock', dur: 0.3, ch: 0.8 },
};
type Entry = [number, FoeSkill];   // [最低境界, 招式]
export interface School { name: string; evil?: boolean; el: El; kit: Entry[] }

export const SCHOOLS: Record<string, School> = {
  huangfeng: { name: '黄枫谷', el: 'sword', kit: [
    [1, S({ id: 'hf_mang', name: '青元剑芒', k: 'beam', len: 560, w: 46, tele: 0.55, dur: 0.3, pow: 2.1, range: 540, min: 90, cd: 6 }, 'sword')],
    [1, S({ id: 'hf_fire', name: '火弹符·连发', k: 'salvo', n: 1, waves: 4, spread: 0.12, tele: 0.3, pow: 0.85, range: 560, min: 120, cd: 6, status: ST.burn }, 'fire')],
    [1, S({ id: 'hf_fly', name: '御剑三连斩', k: 'salvo', n: 3, waves: 2, spread: 0.3, tele: 0.35, pow: 0.9, range: 560, min: 120, cd: 6 }, 'sword')],
    [2, S({ id: 'hf_gold', name: '金光符', k: 'circle', r: 110, tele: 0.8, pow: 2, range: 560, cd: 8, status: ST.stun }, 'gold')],
    [2, S({ id: 'hf_rain', name: '剑雨', k: 'rain', n: 6, r: 80, tele: 1.0, pow: 1.6, range: 560, cd: 10 }, 'sword')],
    [3, S({ id: 'hf_ult', name: '大庚剑阵', k: 'rain', n: 12, r: 95, tele: 1.25, pow: 2.3, range: 680, cd: 18, ult: true, status: ST.break }, 'sword')],
  ] },
  qixuan: { name: '七玄门', el: 'phys', kit: [
    [0, S({ id: 'qx_blade', name: '眨眼剑法', k: 'cone', r: 190, spread: 0.6, tele: 0.35, pow: 1.5, range: 180, cd: 4, waves: 2 }, 'sword')],
    [0, S({ id: 'qx_dart', name: '袖箭连珠', k: 'salvo', n: 3, waves: 2, spread: 0.3, tele: 0.3, pow: 0.7, range: 500, min: 100, cd: 6 }, 'metal')],
    [1, S({ id: 'qx_rush', name: '罗烟步突袭', k: 'charge', len: 420, w: 70, tele: 0.45, pow: 1.8, range: 400, min: 90, cd: 6 }, 'wind')],
  ] },
  yanyue: { name: '掩月宗', el: 'ice', kit: [
    [1, S({ id: 'yy_arrow', name: '寒冰箭', k: 'salvo', n: 3, waves: 2, spread: 0.35, tele: 0.35, pow: 0.85, range: 580, min: 110, cd: 6, status: ST.slow }, 'ice')],
    [1, S({ id: 'yy_moon', name: '月华环', k: 'ring', n: 14, waves: 2, tele: 0.55, pow: 0.75, range: 500, cd: 8, status: ST.slow }, 'water')],
    [1, S({ id: 'yy_blink', name: '幻月身法', k: 'blink', tele: 0.2, pow: 1.4, range: 600, min: 150, cd: 7 }, 'ice')],
    [2, S({ id: 'yy_seal', name: '玄冰封印', k: 'circle', r: 115, tele: 0.85, pow: 1.9, range: 560, cd: 9, status: ST.freeze }, 'ice')],
    [2, S({ id: 'yy_beam', name: '冰魄寒光', k: 'beam', len: 640, w: 54, tele: 0.75, dur: 0.45, pow: 2.3, range: 620, min: 100, cd: 9, status: ST.slow }, 'ice')],
    [3, S({ id: 'yy_ult', name: '明月冰封', k: 'nova', r: 400, tele: 1.5, pow: 3.1, range: 400, cd: 18, ult: true, status: ST.freeze }, 'ice')],
  ] },
  lingshou: { name: '灵兽山', el: 'poison', kit: [
    [1, S({ id: 'ls_beast', name: '驱兽', k: 'summon', n: 2, minion: 'wolf', tele: 0.8, range: 900, cd: 26, once: true }, 'phys')],
    [1, S({ id: 'ls_bug', name: '灵虫群', k: 'ring', n: 12, waves: 2, tele: 0.55, pow: 0.75, range: 480, cd: 8, status: ST.poison }, 'poison')],
    [1, S({ id: 'ls_claw', name: '兽魂扑', k: 'charge', len: 480, w: 80, tele: 0.55, pow: 1.9, range: 460, min: 100, cd: 6, status: ST.break }, 'phys')],
    [2, S({ id: 'ls_mist', name: '五毒瘴', k: 'rain', n: 5, r: 95, tele: 1.0, pow: 1.4, range: 540, cd: 10, status: ST.poison, pool: 3 }, 'poison')],
    [2, S({ id: 'ls_beast2', name: '御兽·火鳞兽', k: 'summon', n: 1, minion: 'firetiger', tele: 0.9, range: 900, cd: 40, once: true, hpBelow: 0.7 }, 'fire')],
    [3, S({ id: 'ls_ult', name: '驭蛟翻浪', k: 'beam', len: 780, w: 110, tele: 1.15, dur: 0.7, pow: 3, range: 740, min: 120, cd: 16, ult: true, status: ST.knock }, 'water')],
  ] },
  qingxu: { name: '清虚门', el: 'thunder', kit: [
    [1, S({ id: 'qx_palm', name: '掌心雷', k: 'nova', r: 170, tele: 0.6, pow: 2, range: 170, cd: 6, status: ST.shock }, 'thunder')],
    [1, S({ id: 'qx_wind', name: '风刃术', k: 'salvo', n: 3, waves: 2, spread: 0.4, tele: 0.3, pow: 0.8, range: 560, min: 100, cd: 5 }, 'wind')],
    [1, S({ id: 'qx_call', name: '引雷符', k: 'circle', r: 105, tele: 0.8, pow: 2, range: 580, cd: 8, status: ST.shock }, 'thunder')],
    [2, S({ id: 'qx_heal', name: '清虚回元', k: 'heal', tele: 0.5, range: 2000, cd: 40, hpBelow: 0.55 }, 'wind')],
    [2, S({ id: 'qx_storm', name: '风雷引', k: 'rain', n: 6, r: 90, tele: 1.0, pow: 1.7, range: 600, cd: 9, status: ST.shock }, 'thunder')],
    [3, S({ id: 'qx_ult', name: '太清神雷', k: 'rain', n: 11, r: 105, tele: 1.25, pow: 2.4, range: 700, cd: 18, ult: true, status: ST.shock }, 'thunder')],
  ] },
  huadao: { name: '化刀坞', el: 'metal', kit: [
    [1, S({ id: 'hd_cut', name: '化血刀芒', k: 'cone', r: 230, spread: 0.6, tele: 0.45, pow: 1.9, range: 220, cd: 5, status: ST.break }, 'metal')],
    [1, S({ id: 'hd_fly', name: '飞刀', k: 'salvo', n: 5, waves: 1, spread: 0.6, tele: 0.35, pow: 0.8, range: 540, min: 110, cd: 5 }, 'metal')],
    [1, S({ id: 'hd_rush', name: '刀行千里', k: 'charge', len: 560, w: 80, tele: 0.5, pow: 2, range: 540, min: 100, cd: 6 }, 'metal')],
    [2, S({ id: 'hd_ring', name: '刀轮', k: 'ring', n: 16, waves: 2, tele: 0.5, pow: 0.8, range: 520, cd: 8 }, 'metal')],
    [3, S({ id: 'hd_ult', name: '万刃归宗', k: 'rain', n: 12, r: 90, tele: 1.2, pow: 2.3, range: 680, cd: 17, ult: true, status: ST.break }, 'metal')],
  ] },
  tianque: { name: '天阙堡', el: 'earth', kit: [
    [1, S({ id: 'tq_spike', name: '地刺', k: 'beam', len: 480, w: 50, tele: 0.6, dur: 0.3, pow: 2, range: 460, min: 90, cd: 6, status: ST.stun }, 'earth')],
    [1, S({ id: 'tq_rock', name: '落石术', k: 'rain', n: 5, r: 90, tele: 1.0, pow: 1.7, range: 560, cd: 9 }, 'earth')],
    [1, S({ id: 'tq_armor', name: '岩甲术', k: 'guard', dur: 5, tele: 0.3, range: 700, cd: 15 }, 'earth')],
    [2, S({ id: 'tq_trap', name: '困阵', k: 'circle', r: 140, tele: 0.8, pow: 1.1, range: 560, cd: 10, status: ST.root, pool: 2.5 }, 'earth')],
    [2, S({ id: 'tq_quake', name: '撼地', k: 'nova', r: 240, tele: 0.9, pow: 2, range: 230, cd: 8, status: ST.slow }, 'earth')],
    [3, S({ id: 'tq_ult', name: '天阙镇岳', k: 'leap', r: 220, tele: 1.2, pow: 3.2, range: 520, min: 80, cd: 16, ult: true, status: ST.stun }, 'earth')],
  ] },
  jujian: { name: '巨剑门', el: 'sword', kit: [
    [1, S({ id: 'jj_chop', name: '巨剑劈山', k: 'leap', r: 150, tele: 0.85, pow: 2.4, range: 440, min: 90, cd: 6, status: ST.knock }, 'sword')],
    [1, S({ id: 'jj_sweep', name: '剑气横扫', k: 'cone', r: 260, spread: 0.9, tele: 0.55, pow: 1.8, range: 250, cd: 5 }, 'sword')],
    [2, S({ id: 'jj_wave', name: '剑浪', k: 'salvo', n: 5, waves: 1, spread: 0.7, tele: 0.4, pow: 1, range: 560, min: 110, cd: 6 }, 'sword')],
    [3, S({ id: 'jj_ult', name: '巨剑贯日', k: 'beam', len: 820, w: 140, tele: 1.2, dur: 0.6, pow: 3.4, range: 780, min: 120, cd: 16, ult: true }, 'gold')],
  ] },
  luoyun: { name: '落云宗', el: 'poison', kit: [
    [1, S({ id: 'ly_vine', name: '藤缚术', k: 'circle', r: 110, tele: 0.75, pow: 1.2, range: 560, cd: 8, status: ST.root }, 'poison')],
    [1, S({ id: 'ly_leaf', name: '乙木剑气', k: 'salvo', n: 3, waves: 2, spread: 0.3, tele: 0.35, pow: 0.9, range: 580, min: 110, cd: 6, status: ST.poison }, 'poison')],
    [1, S({ id: 'ly_heal', name: '回春术', k: 'heal', tele: 0.5, range: 2000, cd: 35, hpBelow: 0.6 }, 'poison')],
    [2, S({ id: 'ly_thorn', name: '荆棘阵', k: 'ring', n: 14, waves: 2, tele: 0.55, pow: 0.75, range: 480, cd: 8, status: ST.slow }, 'poison')],
    [3, S({ id: 'ly_ult', name: '万木回春·青木大阵', k: 'rain', n: 11, r: 100, tele: 1.2, pow: 2.2, range: 680, cd: 18, ult: true, status: ST.root, pool: 2.5 }, 'poison')],
  ] },
  gujian: { name: '古剑门', el: 'sword', kit: [
    [1, S({ id: 'gj_split', name: '剑影分光', k: 'salvo', n: 5, waves: 2, spread: 0.5, tele: 0.35, pow: 0.8, range: 600, min: 120, cd: 6 }, 'sword')],
    [1, S({ id: 'gj_mang', name: '古剑剑芒', k: 'beam', len: 600, w: 50, tele: 0.55, dur: 0.3, pow: 2.2, range: 580, min: 100, cd: 6 }, 'sword')],
    [2, S({ id: 'gj_ring', name: '剑轮护身', k: 'ring', n: 16, waves: 2, tele: 0.5, pow: 0.85, range: 520, cd: 8 }, 'sword')],
    [2, S({ id: 'gj_blink', name: '剑遁', k: 'blink', tele: 0.2, pow: 1.6, range: 640, min: 150, cd: 7 }, 'sword')],
    [3, S({ id: 'gj_ult', name: '古剑万剑诀', k: 'rain', n: 14, r: 85, tele: 1.25, pow: 2.3, range: 700, cd: 18, ult: true }, 'sword')],
  ] },
  baiqiao: { name: '百巧院', el: 'metal', kit: [
    [1, S({ id: 'bq_puppet', name: '放出傀儡', k: 'summon', n: 1, minion: 'shikui', tele: 0.8, range: 900, cd: 30, once: true }, 'earth')],
    [1, S({ id: 'bq_crossbow', name: '机关连弩', k: 'salvo', n: 3, waves: 3, spread: 0.3, tele: 0.35, pow: 0.7, range: 600, min: 120, cd: 6 }, 'metal')],
    [1, S({ id: 'bq_bomb', name: '雷火弹', k: 'circle', r: 120, tele: 0.85, pow: 2.1, range: 560, cd: 8, status: ST.burn, pool: 2 }, 'fire')],
    [2, S({ id: 'bq_array', name: '五雷符阵', k: 'rain', n: 6, r: 90, tele: 1.0, pow: 1.7, range: 580, cd: 10, status: ST.shock }, 'thunder')],
    [3, S({ id: 'bq_ult', name: '金甲傀儡·齐出', k: 'summon', n: 2, minion: 'jinkui', tele: 1.0, range: 900, cd: 45, once: true, hpBelow: 0.7, ult: true }, 'metal')],
  ] },
  // ---------------- 魔道六宗
  guiling: { name: '鬼灵门', evil: true, el: 'ghost', kit: [
    [1, S({ id: 'gl_fire', name: '阴火', k: 'salvo', n: 3, waves: 2, spread: 0.35, tele: 0.35, pow: 0.85, range: 560, min: 110, cd: 6, status: ST.slow }, 'ghost')],
    [1, S({ id: 'gl_soul', name: '摄魂术', k: 'circle', r: 110, tele: 0.85, pow: 1.8, range: 520, cd: 7, status: ST.stun }, 'ghost')],
    [1, S({ id: 'gl_blink', name: '鬼影遁', k: 'blink', tele: 0.25, pow: 1.4, range: 620, min: 160, cd: 7 }, 'ghost')],
    [2, S({ id: 'gl_call', name: '招魂幡', k: 'summon', n: 2, minion: 'yinhun', tele: 0.9, range: 900, cd: 30, once: true, hpBelow: 0.75 }, 'ghost')],
    [2, S({ id: 'gl_drill', name: '血灵钻', k: 'beam', len: 620, w: 44, tele: 0.6, dur: 0.35, pow: 2.4, range: 600, min: 100, cd: 8, status: ST.break }, 'blood')],
    [3, S({ id: 'gl_ult', name: '万鬼噬魂', k: 'ring', n: 26, waves: 3, tele: 0.9, pow: 1, range: 600, cd: 17, ult: true, status: ST.stun }, 'ghost')],
  ] },
  hehuan: { name: '合欢宗', evil: true, el: 'poison', kit: [
    [1, S({ id: 'hh_scent', name: '迷魂香', k: 'circle', r: 130, tele: 0.8, pow: 1.2, range: 540, cd: 8, status: ST.stun, pool: 2.5 }, 'poison')],
    [1, S({ id: 'hh_silk', name: '红绫缚', k: 'beam', len: 540, w: 40, tele: 0.5, dur: 0.3, pow: 1.6, range: 520, min: 90, cd: 7, status: ST.root }, 'blood')],
    [1, S({ id: 'hh_blink', name: '魅影', k: 'blink', tele: 0.2, pow: 1.3, range: 600, min: 140, cd: 6 }, 'poison')],
    [2, S({ id: 'hh_bell', name: '合欢铃', k: 'roar', r: 240, tele: 0.65, pow: 0.9, range: 240, cd: 12, status: ST.stun }, 'ghost')],
    [2, S({ id: 'hh_needle', name: '销魂针', k: 'salvo', n: 7, waves: 1, spread: 0.8, tele: 0.4, pow: 0.65, range: 540, min: 100, cd: 6, status: ST.poison }, 'metal')],
    [3, S({ id: 'hh_ult', name: '姹女迷天', k: 'nova', r: 400, tele: 1.4, pow: 2.6, range: 400, cd: 18, ult: true, status: ST.slow, pool: 3 }, 'poison')],
  ] },
  yuling: { name: '御灵宗', evil: true, el: 'ghost', kit: [
    [1, S({ id: 'yl_spirit', name: '御灵', k: 'summon', n: 2, minion: 'yinhun', tele: 0.8, range: 900, cd: 28, once: true }, 'ghost')],
    [1, S({ id: 'yl_claw', name: '灵兽爪', k: 'charge', len: 480, w: 80, tele: 0.5, pow: 1.9, range: 460, min: 100, cd: 6, status: ST.break }, 'phys')],
    [1, S({ id: 'yl_fire', name: '魂火', k: 'salvo', n: 1, waves: 4, spread: 0.12, tele: 0.3, pow: 0.9, range: 560, min: 110, cd: 6 }, 'ghost')],
    [2, S({ id: 'yl_pull', name: '夺魄', k: 'circle', r: 120, tele: 0.85, pow: 1.9, range: 540, cd: 8, status: ST.slow }, 'ghost')],
    [3, S({ id: 'yl_ult', name: '鬼将出世', k: 'summon', n: 1, minion: 'guijiang', tele: 1.0, range: 900, cd: 45, once: true, hpBelow: 0.7, ult: true }, 'ghost')],
  ] },
  tiansha: { name: '天煞宗', evil: true, el: 'blood', kit: [
    [1, S({ id: 'ts_claw', name: '血魔爪', k: 'cone', r: 220, spread: 0.75, tele: 0.5, pow: 1.9, range: 210, cd: 5, status: ST.break }, 'blood')],
    [1, S({ id: 'ts_blink', name: '血影遁', k: 'blink', tele: 0.25, pow: 1.4, range: 620, min: 160, cd: 7 }, 'blood')],
    [1, S({ id: 'ts_beam', name: '天煞血光', k: 'beam', len: 600, w: 50, tele: 0.6, dur: 0.35, pow: 2.3, range: 580, min: 100, cd: 7 }, 'blood')],
    [2, S({ id: 'ts_rain', name: '血雨', k: 'rain', n: 6, r: 90, tele: 1.0, pow: 1.7, range: 580, cd: 9, status: ST.break, pool: 2 }, 'blood')],
    [2, S({ id: 'ts_nova', name: '煞气爆', k: 'nova', r: 220, tele: 0.75, pow: 2, range: 210, cd: 8 }, 'blood')],
    [3, S({ id: 'ts_ult', name: '天煞血河', k: 'beam', len: 860, w: 140, tele: 1.2, dur: 0.8, pow: 3.4, range: 800, min: 120, cd: 16, ult: true, status: ST.break }, 'blood')],
  ] },
  qianhuan: { name: '千幻宗', evil: true, el: 'ghost', kit: [
    [1, S({ id: 'qh_clone', name: '千幻分身', k: 'summon', n: 2, minion: '@self', tele: 0.6, range: 900, cd: 25, once: true, hpBelow: 0.85 }, 'ghost')],
    [1, S({ id: 'qh_needle', name: '千幻针', k: 'salvo', n: 5, waves: 2, spread: 0.6, tele: 0.35, pow: 0.7, range: 560, min: 110, cd: 6 }, 'metal')],
    [1, S({ id: 'qh_blink', name: '幻形', k: 'blink', tele: 0.15, pow: 1.3, range: 640, min: 150, cd: 5 }, 'ghost')],
    [2, S({ id: 'qh_maze', name: '幻阵', k: 'circle', r: 150, tele: 0.8, pow: 1.2, range: 560, cd: 9, status: ST.slow, pool: 3 }, 'ghost')],
    [3, S({ id: 'qh_ult', name: '千幻迷天', k: 'ring', n: 24, waves: 3, tele: 0.9, pow: 1, range: 600, cd: 17, ult: true, status: ST.stun }, 'ghost')],
  ] },
  yinluo: { name: '阴罗宗', evil: true, el: 'poison', kit: [
    [1, S({ id: 'yl2_corpse', name: '驭尸', k: 'summon', n: 2, minion: 'lianshi', tele: 0.9, range: 900, cd: 30, once: true }, 'poison')],
    [1, S({ id: 'yl2_claw', name: '阴罗鬼爪', k: 'cone', r: 210, spread: 0.7, tele: 0.5, pow: 1.8, range: 200, cd: 5, status: ST.poison }, 'ghost')],
    [1, S({ id: 'yl2_rain', name: '尸毒雨', k: 'rain', n: 5, r: 90, tele: 1.0, pow: 1.4, range: 540, cd: 9, status: ST.poison, pool: 3 }, 'poison')],
    [2, S({ id: 'yl2_ring', name: '阴煞环', k: 'ring', n: 16, waves: 2, tele: 0.55, pow: 0.8, range: 500, cd: 8, status: ST.slow }, 'ghost')],
    [3, S({ id: 'yl2_ult', name: '阴罗幡·万魂', k: 'nova', r: 420, tele: 1.5, pow: 3, range: 420, cd: 18, ult: true, status: ST.poison, pool: 3 }, 'ghost')],
  ] },
  tianmo: { name: '天魔宗', evil: true, el: 'blood', kit: [
    [1, S({ id: 'tm_fire', name: '青阳魔火', k: 'salvo', n: 3, waves: 2, spread: 0.35, tele: 0.35, pow: 0.9, range: 580, min: 110, cd: 6, status: ST.burn }, 'fire')],
    [1, S({ id: 'tm_shadow', name: '魔影闪', k: 'blink', tele: 0.2, pow: 1.6, range: 660, min: 160, cd: 6 }, 'blood')],
    [2, S({ id: 'tm_pillar', name: '魔焰柱', k: 'beam', len: 680, w: 70, tele: 0.7, dur: 0.5, pow: 2.5, range: 640, min: 100, cd: 8, status: ST.burn }, 'blood')],
    [2, S({ id: 'tm_ring', name: '天魔环', k: 'ring', n: 20, waves: 2, tele: 0.6, pow: 0.85, range: 560, cd: 8 }, 'blood')],
    [3, S({ id: 'tm_ult', name: '天魔解体', k: 'nova', r: 440, tele: 1.5, pow: 3.4, range: 440, cd: 18, ult: true, status: ST.burn }, 'blood')],
  ] },
  // ---------------- 其他 / 散修 / 劫修 / 乱星海 / 大晋
  huayi: { name: '化意门', el: 'water', kit: [
    [1, S({ id: 'hy_water', name: '水箭术', k: 'salvo', n: 3, waves: 2, spread: 0.35, tele: 0.3, pow: 0.85, range: 580, min: 110, cd: 5, status: ST.slow }, 'water')],
    [1, S({ id: 'hy_wave', name: '浪涌', k: 'cone', r: 260, spread: 0.7, tele: 0.6, pow: 1.8, range: 250, cd: 6, status: ST.knock }, 'water')],
    [2, S({ id: 'hy_bubble', name: '水牢术', k: 'circle', r: 110, tele: 0.8, pow: 1.4, range: 560, cd: 9, status: ST.root }, 'water')],
    [3, S({ id: 'hy_ult', name: '化意沧澜', k: 'beam', len: 820, w: 130, tele: 1.2, dur: 0.8, pow: 3.2, range: 780, min: 120, cd: 16, ult: true, status: ST.slow }, 'water')],
  ] },
  qianzhu: { name: '千竹教', el: 'thunder', kit: [
    [1, S({ id: 'qz_bamboo', name: '竹影剑', k: 'salvo', n: 5, waves: 1, spread: 0.6, tele: 0.35, pow: 0.85, range: 560, min: 110, cd: 6 }, 'sword')],
    [1, S({ id: 'qz_bug', name: '放虫', k: 'ring', n: 12, waves: 2, tele: 0.55, pow: 0.75, range: 480, cd: 8, status: ST.poison }, 'poison')],
    [2, S({ id: 'qz_thunder', name: '竹雷', k: 'circle', r: 110, tele: 0.8, pow: 2.1, range: 580, cd: 8, status: ST.shock }, 'thunder')],
    [3, S({ id: 'qz_ult', name: '千竹雷阵', k: 'rain', n: 12, r: 95, tele: 1.2, pow: 2.3, range: 700, cd: 18, ult: true, status: ST.shock }, 'thunder')],
  ] },
  taiyi: { name: '太一门', el: 'gold', kit: [
    [1, S({ id: 'ty_light', name: '太一神光', k: 'beam', len: 620, w: 54, tele: 0.6, dur: 0.4, pow: 2.3, range: 600, min: 100, cd: 7 }, 'gold')],
    [1, S({ id: 'ty_sword', name: '飞剑连斩', k: 'salvo', n: 3, waves: 2, spread: 0.3, tele: 0.3, pow: 0.9, range: 580, min: 110, cd: 6 }, 'sword')],
    [2, S({ id: 'ty_seal', name: '太一印', k: 'circle', r: 130, tele: 0.85, pow: 2.2, range: 580, cd: 9, status: ST.stun }, 'gold')],
    [3, S({ id: 'ty_ult', name: '太一化清', k: 'rain', n: 12, r: 100, tele: 1.2, pow: 2.4, range: 720, cd: 18, ult: true }, 'gold')],
  ] },
  xinggong: { name: '星宫', el: 'gold', kit: [
    [1, S({ id: 'xg_star', name: '星光箭', k: 'salvo', n: 3, waves: 2, spread: 0.4, tele: 0.35, pow: 0.85, range: 600, min: 120, cd: 6 }, 'gold')],
    [1, S({ id: 'xg_fall', name: '星落', k: 'rain', n: 5, r: 90, tele: 1.0, pow: 1.7, range: 580, cd: 9, status: ST.stun }, 'gold')],
    [2, S({ id: 'xg_mag', name: '元磁神光', k: 'beam', len: 640, w: 56, tele: 0.7, dur: 0.45, pow: 2.3, range: 620, min: 100, cd: 9, status: ST.root }, 'metal')],
    [3, S({ id: 'xg_ult', name: '周天星斗阵', k: 'rain', n: 14, r: 100, tele: 1.3, pow: 2.4, range: 740, cd: 18, ult: true, status: ST.stun }, 'gold')],
  ] },
  jiyin: { name: '极阴岛', evil: true, el: 'ice', kit: [
    [1, S({ id: 'jy_qi', name: '玄阴魔气', k: 'cone', r: 260, spread: 0.6, tele: 0.6, pow: 1.9, range: 250, cd: 6, status: ST.freeze }, 'ice')],
    [1, S({ id: 'jy_fire', name: '阴火', k: 'salvo', n: 3, waves: 2, spread: 0.35, tele: 0.35, pow: 0.85, range: 560, min: 110, cd: 6 }, 'ghost')],
    [2, S({ id: 'jy_banner', name: '阴罗幡', k: 'summon', n: 2, minion: 'yinhun', tele: 0.9, range: 900, cd: 30, once: true, hpBelow: 0.75 }, 'ghost')],
    [3, S({ id: 'jy_ult', name: '玄阴寒狱', k: 'nova', r: 420, tele: 1.5, pow: 3.2, range: 420, cd: 18, ult: true, status: ST.freeze }, 'ice')],
  ] },
  sanxiu: { name: '散修', el: 'fire', kit: [] },   // 随机两系（见 sanxiuKit）
  // 第三十六步：慕兰法士 / 逆星盟 / 妙音门
  mulan: { name: '慕兰法士', el: 'wind', kit: [
    [1, S({ id: 'ml_wind', name: '天澜风刃', k: 'salvo', n: 5, waves: 2, spread: 0.7, tele: 0.4, pow: 0.75, range: 640, min: 120, cd: 6 }, 'wind')],
    [1, S({ id: 'ml_totem', name: '图腾雷咒', k: 'rain', n: 6, r: 95, tele: 1.0, pow: 1.6, range: 620, cd: 9, status: ST.shock }, 'thunder')],
    [2, S({ id: 'ml_beast', name: '召唤图腾兽', k: 'summon', n: 2, minion: 'steppewolf', tele: 0.9, range: 900, cd: 28, once: true, hpBelow: 0.8 }, 'earth')],
    [2, S({ id: 'ml_sand', name: '黄沙缚', k: 'circle', r: 150, tele: 0.8, pow: 1.4, range: 600, cd: 10, status: ST.root, pool: 3 }, 'earth')],
    [3, S({ id: 'ml_ult', name: '天澜圣光', k: 'beam', len: 760, w: 80, tele: 1.1, dur: 0.6, pow: 3.0, range: 720, min: 100, cd: 18, ult: true, status: ST.stun }, 'gold')],
  ] },
  nixing: { name: '逆星盟', evil: true, el: 'blood', kit: [
    [1, S({ id: 'nx_blade', name: '血煞刀芒', k: 'cone', r: 240, spread: 0.55, tele: 0.5, pow: 1.8, range: 240, cd: 6, status: ST.break }, 'blood')],
    [1, S({ id: 'nx_star', name: '逆星锥', k: 'salvo', n: 4, waves: 2, spread: 0.4, tele: 0.35, pow: 0.85, range: 600, min: 120, cd: 6 }, 'metal')],
    [2, S({ id: 'nx_leap', name: '血遁突袭', k: 'blink', tele: 0.3, pow: 2.0, range: 620, min: 150, cd: 7 }, 'blood')],
    [2, S({ id: 'nx_bomb', name: '阴雷', k: 'circle', r: 150, tele: 0.9, pow: 2.5, range: 580, cd: 12, status: ST.shock }, 'thunder')],
    [3, S({ id: 'nx_ult', name: '万魂血河', k: 'nova', r: 440, tele: 1.4, pow: 3.1, range: 440, cd: 18, ult: true, status: ST.poison }, 'blood')],
  ] },
  miaoyin: { name: '妙音门', el: 'wind', kit: [
    [1, S({ id: 'my_note', name: '天魔音刃', k: 'salvo', n: 5, waves: 2, spread: 0.6, tele: 0.35, pow: 0.75, range: 620, min: 110, cd: 6, status: ST.stun }, 'wind')],
    [1, S({ id: 'my_ring', name: '摄魂琴音', k: 'ring', n: 14, waves: 1, tele: 0.6, pow: 0.8, range: 480, cd: 8, status: ST.slow }, 'ghost')],
    [2, S({ id: 'my_heal', name: '清心曲', k: 'heal', tele: 0.5, range: 2000, cd: 36, hpBelow: 0.55 }, 'water')],
    [3, S({ id: 'my_ult', name: '万籁俱寂', k: 'nova', r: 420, tele: 1.3, pow: 2.8, range: 420, cd: 18, ult: true, status: ST.stun }, 'wind')],
  ] },
  jiexiu: { name: '劫修', evil: true, el: 'metal', kit: [
    [1, S({ id: 'jx_needle', name: '暴雨梨花针', k: 'salvo', n: 9, waves: 1, spread: 0.9, tele: 0.45, pow: 0.6, range: 520, min: 100, cd: 6, status: ST.poison }, 'metal')],
    [1, S({ id: 'jx_smoke', name: '迷烟弹', k: 'circle', r: 130, tele: 0.75, pow: 1.1, range: 540, cd: 8, status: ST.slow, pool: 3 }, 'poison')],
    [1, S({ id: 'jx_seal', name: '定身符', k: 'salvo', n: 3, waves: 1, spread: 0.35, tele: 0.35, pow: 0.7, range: 620, min: 120, cd: 9, status: ST.stun }, 'gold')],
    [2, S({ id: 'jx_blink', name: '土遁偷袭', k: 'blink', tele: 0.3, pow: 1.8, range: 600, min: 150, cd: 7 }, 'earth')],
    [2, S({ id: 'jx_bomb', name: '天雷子', k: 'circle', r: 140, tele: 0.9, pow: 2.6, range: 580, cd: 12, status: ST.shock }, 'thunder')],
    [3, S({ id: 'jx_ult', name: '夺命飞刃', k: 'rain', n: 10, r: 85, tele: 1.1, pow: 2.3, range: 680, cd: 17, ult: true, status: ST.break }, 'metal')],
  ] },
};

/** 散修：两系各取其二 */
const ELEM: Record<string, Entry[]> = {
  fire: [[1, S({ id: 'sx_fire', name: '火弹术·连发', k: 'salvo', n: 1, waves: 4, spread: 0.12, tele: 0.3, pow: 0.9, range: 560, min: 120, cd: 5, status: ST.burn }, 'fire')], [1, S({ id: 'sx_firerain', name: '火雨符', k: 'rain', n: 5, r: 85, tele: 1.0, pow: 1.7, range: 560, cd: 9, status: ST.burn, pool: 2.5 }, 'fire')], [2, S({ id: 'sx_snake', name: '火蛇术', k: 'beam', len: 560, w: 60, tele: 0.6, dur: 0.5, pow: 2.2, range: 540, min: 100, cd: 8, status: ST.burn }, 'fire')]],
  ice: [[1, S({ id: 'sx_ice', name: '冰锥术', k: 'salvo', n: 3, waves: 2, spread: 0.35, tele: 0.35, pow: 0.85, range: 580, min: 110, cd: 6, status: ST.slow }, 'ice')], [2, S({ id: 'sx_frost', name: '冰封', k: 'circle', r: 110, tele: 0.85, pow: 1.8, range: 560, cd: 9, status: ST.freeze }, 'ice')]],
  thunder: [[1, S({ id: 'sx_thunder', name: '引雷术', k: 'circle', r: 105, tele: 0.8, pow: 2, range: 580, cd: 8, status: ST.shock }, 'thunder')], [2, S({ id: 'sx_palm', name: '掌心雷', k: 'nova', r: 170, tele: 0.6, pow: 2, range: 170, cd: 6, status: ST.shock }, 'thunder')]],
  wind: [[1, S({ id: 'sx_wind', name: '风刃术', k: 'salvo', n: 3, waves: 2, spread: 0.4, tele: 0.3, pow: 0.8, range: 560, min: 100, cd: 5 }, 'wind')], [2, S({ id: 'sx_gale', name: '旋风术', k: 'circle', r: 120, tele: 0.85, pow: 1.7, range: 540, cd: 8, status: ST.slow, pool: 2 }, 'wind')]],
  earth: [[1, S({ id: 'sx_spike', name: '地刺术', k: 'beam', len: 480, w: 50, tele: 0.6, dur: 0.3, pow: 2, range: 460, min: 90, cd: 6, status: ST.stun }, 'earth')], [2, S({ id: 'sx_sand', name: '流沙陷', k: 'circle', r: 140, tele: 0.8, pow: 1.1, range: 540, cd: 9, status: ST.slow, pool: 3 }, 'earth')]],
  sword: [[1, S({ id: 'sx_sword', name: '御剑术', k: 'salvo', n: 3, waves: 2, spread: 0.3, tele: 0.35, pow: 0.9, range: 560, min: 120, cd: 6 }, 'sword')], [2, S({ id: 'sx_mang', name: '剑芒', k: 'beam', len: 560, w: 46, tele: 0.6, dur: 0.3, pow: 2.1, range: 540, min: 100, cd: 6 }, 'sword')]],
};

/** 按 NPC 门派 / 势力 / 敌人种类 / 地区定流派 */
export function schoolOf(e: Enemy): string {
  if (e.school && (SCHOOLS[e.school] || e.school === 'sanxiu')) return e.school;
  const id = e.def.id, evil = !!e.def.evil, r = Math.random();
  let s: string;
  if (ACTIVE_MAP === 'luanxing') s = evil ? (r < 0.5 ? 'jiyin' : 'jiexiu') : r < 0.45 ? 'xinggong' : r < 0.8 ? 'sanxiu' : 'jiexiu';
  else if (ACTIVE_MAP === 'dajin') s = evil ? (r < 0.5 ? 'tianmo' : 'jiyin') : r < 0.4 ? 'taiyi' : r < 0.6 ? 'huayi' : r < 0.75 ? 'qianzhu' : 'sanxiu';
  else if (id === 'bandit' || id === 'yelang' || id === 'duba') s = r < 0.6 ? 'jiexiu' : 'sanxiu';
  else if (evil) s = ['guiling', 'hehuan', 'yuling', 'tiansha', 'qianhuan', 'yinluo', 'tiansha', 'guiling'][Math.floor(r * 8)];
  else s = r < 0.45 ? 'sanxiu' : r < 0.7 ? 'jiexiu' : ['huangfeng', 'yanyue', 'qingxu', 'huadao', 'tianque', 'jujian', 'luoyun', 'gujian', 'baiqiao', 'lingshou'][Math.floor(Math.random() * 10)];
  e.school = s;
  return s;
}

const shuffle = <T,>(a: T[]) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/** 修士配招：招牌一式 + 随机若干（境界越高越多），筑基起护体 / 回春，结丹起大招 */
export function schoolKit(e: Enemy, elite: boolean): FoeSkill[] {
  const sid = schoolOf(e), sc = SCHOOLS[sid], r = Math.max(1, e.realm);
  let entries: Entry[];
  if (sid === 'sanxiu' || !sc) {
    const keys = shuffle(Object.keys(ELEM)).slice(0, 2);
    entries = [...ELEM[keys[0]], ...ELEM[keys[1]]];
  } else entries = sc.kit;
  const ok = entries.filter(([m]) => m <= r).map(([, s]) => s);
  const ult = ok.filter((s) => s.ult), rest = ok.filter((s) => !s.ult);
  const sig = rest.shift();
  const n = (r <= 1 ? 2 : r === 2 ? 3 : 4) + (elite ? 1 : 0);
  const out: FoeSkill[] = sig ? [sig] : [];
  out.push(...shuffle(rest).slice(0, n));
  if (r >= 2 && !out.some((s) => s.k === 'guard')) out.push(S({ id: 'h_guard', name: sc?.evil ? '魔气护体' : '护体灵光', k: 'guard', dur: 4, tele: 0.3, range: 700, cd: 16 }, 'gold'));
  if (!out.some((s) => s.k === 'heal')) out.push(S({ id: 'h_pill', name: '服下回春丹', k: 'heal', tele: 0.4, range: 2000, cd: 60, once: true, hpBelow: 0.4 }, 'poison'));
  if ((r >= 3 || elite) && ult.length) out.push(ult[0]);
  // 散修结丹：通用大招
  if (r >= 3 && !out.some((s) => s.ult)) out.push(S({ id: 'h_big', name: sc?.evil ? '法宝·血河幡' : '法宝·巨剑斩', k: 'beam', len: 760, w: 120, tele: 1.1, dur: 0.5, pow: 3.2, range: 720, min: 120, cd: 14, ult: true }, sc?.evil ? 'blood' : 'gold'));
  return out;
}

/** 招式所用五行（供命中特效、门派提示） */
export function schoolName(e: Enemy) { const s = e.school ? SCHOOLS[e.school] : undefined; return s?.name ?? ''; }
