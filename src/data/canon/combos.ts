// 第 4 阶段（s4-content）：套路搭配——特定功法 × 法宝出强力效果
// 条件：主修功法（指定 id，或按五行 / 路子）、辅修、法宝（指定 id / 出手方式 / 属性）；效果在法宝出手时生效（world/artacts.ts）
import type { ArtKind } from '../items';
import type { School } from '../arts';
import type { Wx } from './types';
import type { AuxKind } from './gongfa';

export interface ComboFx { dmg?: number; pieces?: number; addPieces?: number; freeze?: boolean; burn?: boolean; stun?: boolean; radius?: number; dur?: number; chain?: number; exec?: number; heal?: number; shield?: number }
export interface ComboDef {
  id: string; name: string; desc: string;
  gf?: string[]; wx?: Wx[]; path?: School; aux?: (AuxKind | string)[];
  item?: string[]; kind?: ArtKind[]; el?: Wx[];
  /** 本门功法 + 本门法器 */
  sameSect?: boolean;
  fx: ComboFx;
  /** 已有的系统（只在面板上列出） */
  builtin?: boolean;
}
export const COMBOS: ComboDef[] = [
  { id: 'dageng', name: '大庚剑阵', desc: '青元剑诀 + 青竹蜂云剑（熔入庚精）：七十二口飞剑布成剑阵，万剑绞杀。', gf: ['qingyuan'], item: ['art_qingzhu'], fx: {}, builtin: true },
  { id: 'yinhun', name: '阴魂缠身', desc: '鬼道魔功 + 魔幡：幡中阴魂得功法滋养，凶性大增（威力 ×1.4，持续 ×1.5）。', gf: ['xuanyin', 'guilingjing', 'yinluo', 'youming', 'jiuyoulian', 'tianmojing'], kind: ['banner'], fx: { dmg: 1.4, dur: 1.5 } },
  { id: 'fati', name: '法体双修', desc: '炼体主修 + 砖山 / 大印 / 宝塔：肉身之力灌入法宝，砸落时威力 ×1.35，必定震晕。', path: '体', kind: ['slam', 'seal', 'pagoda'], fx: { dmg: 1.35, stun: true } },
  { id: 'dayankui', name: '大衍傀儡术', desc: '大衍诀 / 傀儡秘术 + 傀儡：一念分驭，傀儡一次放出两具。', aux: ['dayan', 'dayankui', 'kui'], kind: ['puppet'], fx: { addPieces: 1, dmg: 1.15 } },
  { id: 'binghun', name: '冰魄寒光', desc: '冰水主修 + 冰属法宝：寒气相生，命中必定冰封，威力 ×1.2。', wx: ['ice', 'water'], el: ['ice'], fx: { dmg: 1.2, freeze: true } },
  { id: 'leizhu', name: '掌心雷珠', desc: '雷法主修 + 连珠：雷珠多跳三人，威力 ×1.2。', wx: ['thunder'], kind: ['beads'], fx: { dmg: 1.2, chain: 3 } },
  { id: 'fenghuo', name: '风助火势', desc: '火法主修 + 扇：扇出的风里裹着真火，必定点燃，威力 ×1.35。', wx: ['fire'], kind: ['fan'], fx: { dmg: 1.35, burn: true } },
  { id: 'xingdou', name: '周天星斗', desc: '周天星辰诀 / 星斗阵图 + 阵盘：阵势扩大六成，威力 ×1.3。', gf: ['xingchen', 'wanfa'], aux: ['zhoutiantu', 'zhen'], kind: ['disk'], fx: { radius: 1.6, dmg: 1.3 } },
  { id: 'shehun', name: '摄魂灯照', desc: '阴属魔功 + 魂灯：灯火摄来的魂力反哺己身（伤害三成化为气血），威力 ×1.5。', wx: ['yin'], kind: ['lamp'], fx: { dmg: 1.5, heal: 0.3 } },
  { id: 'wanshou', name: '万兽归葫', desc: '御兽一脉 + 葫芦：气血四成以下的敌人便能收入葫中。', path: '御', aux: ['shou'], kind: ['gourd'], fx: { exec: 0.4, dmg: 1.2 } },
  { id: 'renjian', name: '人剑合一', desc: '剑修主修 + 飞剑：多驭一口飞剑，威力 ×1.15。', path: '剑', kind: ['sword'], fx: { addPieces: 1, dmg: 1.15 } },
  { id: 'qingmu', name: '青木华盖', desc: '木法主修 + 伞：伞面生出青木灵光，护盾 ×1.5，收伞时回复气血。', wx: ['wood'], kind: ['umbrella'], fx: { shield: 1.5, heal: 0.15 } },
  { id: 'tongmen', name: '同门心法', desc: '本门镇派功法 + 本门法器 / 镇宗之宝：心法与法器同出一源，威力 ×1.25。', sameSect: true, fx: { dmg: 1.25 } },
];
