// 法器外观（代码绘制）：每件法器的造型与配色，按原著描写。
// shape 决定画法；c1 主色、c2 副色、glow 灵光色（"r,g,b"）。
export type ArtShape =
  | 'jian' | 'bamboo' | 'jinfu' | 'jinfuChild' | 'needle' | 'ring' | 'bracelet' | 'mirror' | 'bagua'
  | 'brick' | 'hook' | 'thorn' | 'arrow' | 'bell' | 'ribbon' | 'pouch' | 'fan' | 'flame' | 'banner'
  | 'bonebanner' | 'ding' | 'shield' | 'turtle' | 'armor' | 'cloak' | 'wings' | 'boat' | 'talisman'
  | 'bottle' | 'bead' | 'boots' | 'mountain' | 'basket' | 'demon';

export interface ArtLook { shape: ArtShape; c1: string; c2: string; glow: string }

const L = (shape: ArtShape, c1: string, c2: string, glow: string): ArtLook => ({ shape, c1, c2, glow });

export const ART_LOOK: Record<string, ArtLook> = {
  // —— 飞剑
  art_qingfeng: L('jian', '#b8cfc6', '#3f6a58', '160,235,210'),
  art_yinhui: L('jian', '#e4ecf2', '#6a7a8a', '220,235,255'),
  art_lvhuang: L('jian', '#8fe0a0', '#2f7a48', '120,255,150'),
  art_xuemo: L('jian', '#c84a4a', '#4a1418', '255,70,70'),
  art_qingzhu: L('bamboo', '#7fc08a', '#d8b850', '255,225,110'),
  // —— 成套飞刃 / 飞针
  art_jinfu: L('jinfu', '#e8c060', '#8a5a20', '255,215,120'),
  art_hongxian: L('needle', '#e8e0d8', '#c02828', '255,90,90'),
  art_tianyang: L('needle', '#ffd870', '#c07020', '255,200,90'),
  art_huolan: L('basket', '#e8a0c0', '#8a5a3a', '255,150,200'),
  // —— 刺 / 箭 / 夺
  art_wulong: L('hook', '#3a4048', '#0e1216', '120,150,200'),
  art_zhuxie: L('thorn', '#b83030', '#3a0e10', '255,60,60'),
  art_miemo: L('arrow', '#d8c070', '#4f8a50', '255,230,120'),
  art_jianfu: L('talisman', '#e8d080', '#b02a1a', '200,255,230'),
  art_fuguang: L('talisman', '#f0dc90', '#c0901a', '255,230,140'),
  // —— 环 / 镯
  art_zhuque: L('ring', '#e05030', '#f0c050', '255,120,50'),
  art_wuxing: L('ring', '#d8b860', '#7a5a20', '255,225,140'),
  art_zibing: L('bracelet', '#b090f0', '#e8e0ff', '190,160,255'),
  // —— 镜
  art_qingning: L('mirror', '#70c0b0', '#9a7a40', '120,230,210'),
  art_ningguang: L('mirror', '#30343a', '#8a7040', '255,240,200'),
  art_bamen: L('bagua', '#e8c860', '#7a5a20', '255,225,120'),
  // —— 砖 / 山
  art_jinguangzhuan: L('brick', '#e8c050', '#8a6018', '255,215,90'),
  art_lanjin: L('brick', '#4a78c8', '#d8b860', '120,170,255'),
  art_yuanci: L('mountain', '#6a7890', '#c8a860', '170,200,255'),
  // —— 钟 / 带
  art_yinzhong: L('bell', '#d0d8e0', '#6a7480', '220,235,255'),
  art_sixiang: L('ribbon', '#60a0d0', '#e0c060', '140,200,255'),
  // —— 火
  art_ziyou: L('pouch', '#8a4ab0', '#e0b050', '255,170,80'),
  art_tiandu: L('flame', '#3a5a3a', '#8aff9a', '120,255,140'),
  art_qianlan: L('flame', '#4a80c0', '#c8f0ff', '130,200,255'),
  art_sanyan: L('fan', '#c03a2a', '#e0c050', '255,150,60'),
  // —— 幡 / 旗
  art_qingjiao: L('banner', '#3a9a7a', '#d8c070', '110,230,190'),
  art_guiluo: L('banner', '#2a2228', '#a02030', '200,60,90'),
  art_sanshen: L('bonebanner', '#e0d8c8', '#4a4038', '230,220,200'),
  art_wuzi: L('demon', '#2a1a22', '#c02840', '230,60,100'),
  // —— 鼎
  art_xutian: L('ding', '#5a8a6a', '#d8c070', '140,255,190'),
  // —— 防具
  art_guike: L('turtle', '#7a8a5a', '#3a4428', '190,220,140'),
  art_qingtong: L('shield', '#6a8a6a', '#c8a860', '170,230,180'),
  art_languang: L('shield', '#4a7ac0', '#c8e0f0', '120,190,255'),
  art_xuantie: L('shield', '#4a4e58', '#9aa0b0', '170,180,220'),
  art_huanglin: L('armor', '#c0a040', '#6a5018', '255,220,120'),
  art_xuepifeng: L('cloak', '#a82030', '#4a0a10', '255,60,70'),
  // —— 遁具
  art_shenfeng: L('boat', '#c8b080', '#4a8a7a', '160,240,220'),
  art_fenglei: L('wings', '#c8a050', '#fff0c0', '255,220,130'),
  art_tayun: L('boots', '#5a5048', '#e8e4dc', '230,240,255'),
  // —— 其它
  item_bottle: L('bottle', '#3f6a4a', '#9ad8a8', '140,255,180'),
  tal_tianleizi: L('bead', '#2a2a34', '#c8d0ff', '170,190,255'),
  tal_fubao: L('talisman', '#f0dc90', '#c0901a', '255,220,120'),
};

/** 未登记的法器按类型给一个默认外观 */
export function artLook(id: string, kind?: string, color?: string): ArtLook {
  const l = ART_LOOK[id];
  if (l) return l;
  const c = color ?? '#c0c8c0';
  const map: Record<string, ArtShape> = { sword: 'jian', needle: 'needle', ring: 'ring', mirror: 'mirror', slam: 'brick', arrow: 'thorn', bell: 'bell', bind: 'ribbon', flame: 'flame', banner: 'banner', cauldron: 'ding', shield: 'shield', armor: 'armor', wings: 'wings', flight: 'boat', boots: 'boots' };
  return L(map[kind ?? 'sword'] ?? 'jian', c, '#6a5a40', '220,230,220');
}
