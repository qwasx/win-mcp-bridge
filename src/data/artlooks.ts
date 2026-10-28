// 法器外观（代码绘制）：每件法器的造型与配色，按原著描写。
// shape 决定画法；c1 主色、c2 副色、glow 灵光色（"r,g,b"）。
export type ArtShape =
  | 'jian' | 'bamboo' | 'jinfu' | 'jinfuChild' | 'needle' | 'ring' | 'bracelet' | 'mirror' | 'bagua'
  | 'brick' | 'hook' | 'thorn' | 'arrow' | 'bell' | 'ribbon' | 'pouch' | 'fan' | 'flame' | 'banner'
  | 'bonebanner' | 'ding' | 'shield' | 'turtle' | 'armor' | 'cloak' | 'wings' | 'boat' | 'talisman'
  | 'bottle' | 'bead' | 'boots' | 'mountain' | 'basket' | 'demon'
  // 第 4 阶段（s4-content）
  | 'gourd' | 'umbrella' | 'pagoda' | 'seal' | 'lamp' | 'whip' | 'shuttle' | 'disk' | 'puppet' | 'cover';

import { GEN_LOOK } from './canon/artgen';

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
  // —— 第三十五步：原著法宝 / 灵宝
  art_huangluosan: L('shield', '#d8b040', '#7a5018', '255,220,120'),
  art_wuxingzhen: L('needle', '#d8e4ec', '#8a9aa8', '220,240,255'),
  art_xuehongling: L('ribbon', '#f4eefa', '#b8a8d0', '230,230,255'),
  art_yueyang: L('bead', '#ffe0a0', '#c06020', '255,210,120'),
  art_juhunbo: L('bell', '#4a5a50', '#9adab0', '130,255,170'),
  art_fengyunfan: L('banner', '#80b0c0', '#e0e8f0', '170,230,240'),
  art_qingmingzhen: L('needle', '#60d0c0', '#2a6a60', '120,255,220'),
  art_xuanhuangjing: L('mirror', '#d0b060', '#5a4018', '255,220,120'),
  art_guanrijian: L('jian', '#ffd070', '#a05018', '255,210,110'),
  art_liangyihuan: L('ring', '#e8e8e8', '#202024', '230,230,240'),
  art_yufengche: L('boat', '#b8c8a0', '#6a5a3a', '200,240,200'),
  art_qianchongfeng: L('mountain', '#7a6a50', '#c8b080', '220,190,130'),
  art_xueleizi: L('bead', '#801020', '#ff5060', '255,70,90'),
  art_jingangzhao: L('bell', '#e0c060', '#8a6018', '255,225,130'),
  art_luohunsha: L('pouch', '#6a6050', '#c8b890', '200,190,160'),
  art_leihuogong: L('arrow', '#ffb040', '#6a3a18', '255,200,90'),
  art_sifangxue: L('boots', '#8a7a5a', '#e0d0a0', '230,220,170'),
  art_molongren: L('hook', '#a02040', '#2a1018', '255,60,100'),
  art_pingtianchi: L('talisman', '#e0d0a0', '#8a6a30', '255,230,150'),
  art_balingchi: L('talisman', '#f0e0b0', '#c09030', '255,240,170'),
  art_heifengqi: L('banner', '#25252e', '#7a7a90', '160,170,220'),
  art_zhenhaizhong: L('bell', '#5a9ac0', '#d8e8f0', '140,210,255'),
  art_tianajian: L('jian', '#f0f0ff', '#c0a040', '240,245,255'),
  // 第四十步
  art_zixiao: L('jian', '#c8b0ff', '#5a3a9a', '205,175,255'),
  art_xuanming: L('needle', '#b0e4ff', '#3a6a8a', '170,230,255'),
  art_jiuyanglu: L('ding', '#ff9a40', '#7a2a10', '255,170,80'),
  art_shanheyin: L('mountain', '#b89a60', '#4a3a20', '235,205,140'),
  art_qiankunjing: L('bagua', '#ece2c0', '#6a5a30', '255,240,190'),
  art_xuanwudun: L('turtle', '#4a6a5a', '#c8b070', '160,220,190'),
  art_longlinjia: L('armor', '#6a8a7a', '#d0b060', '170,230,200'),
  art_wanhunfan: L('bonebanner', '#3a2a3a', '#a03040', '200,80,120'),
  art_fulongsuo: L('ribbon', '#e0c060', '#7a5020', '255,220,120'),
  art_yunxiaozhou: L('boat', '#d8e8f0', '#6a8aa0', '220,240,255'),
  art_taixujianxia: L('jian', '#fff6d8', '#8a6a30', '255,245,200'),
  art_zhoutianpan: L('bagua', '#3a4a8a', '#e0d8a0', '190,200,255'),
  art_jiuyoudeng: L('flame', '#70ffa8', '#1a3a2a', '120,255,170'),
  // —— 第三十九步：大路法器
  art_chitong: L('jian', '#d8885a', '#6a3018', '255,150,90'),
  art_taomu: L('jian', '#c8946a', '#5a3a20', '200,210,255'),
  art_feihuang: L('bead', '#5a5a62', '#2a2a30', '200,200,210'),
  art_huolongbiao: L('arrow', '#ff7a40', '#8a3018', '255,140,70'),
  art_bingpo: L('jian', '#c8ecff', '#5a8aa8', '170,225,255'),
  art_leiyin: L('bead', '#a090ff', '#3a2a80', '180,160,255'),
  art_liujiao: L('shield', '#c8f0ff', '#6aa0c8', '180,230,255'),
  art_lingshe: L('ribbon', '#6ab070', '#2a5030', '140,230,150'),
  art_shehun: L('bell', '#8a9a7a', '#3a4430', '190,230,170'),
  art_zhaoyao: L('mirror', '#f0d070', '#8a6020', '255,230,130'),
  art_ruanwei: L('armor', '#8a7a6a', '#3a3028', '220,200,170'),
  art_qingyunxue: L('boots', '#7a9ab0', '#e0e8f0', '200,230,255'),
  art_chiyan: L('jian', '#ff7040', '#7a2010', '255,120,60'),
  art_qixing: L('needle', '#e0f0ff', '#4a6a9a', '200,230,255'),
  art_hanjiang: L('ribbon', '#a8bccc', '#3a5068', '170,215,255'),
  art_heisha: L('banner', '#2a2430', '#8a7aa0', '170,140,220'),
  art_zijinbo: L('ding', '#c8a050', '#6a3a8a', '255,215,130'),
  art_lieyan: L('fan', '#ff7a30', '#6a2a10', '255,150,60'),
  art_xuangui: L('turtle', '#8a7a48', '#3a3018', '230,210,130'),
  art_feisuo: L('boat', '#eef2f6', '#8aa0b0', '220,240,255'),
  art_gengjin: L('jian', '#f4e8b0', '#8a7030', '255,240,170'),
  art_wulei: L('ring', '#c0b0ff', '#4a3aa0', '190,170,255'),
  art_xuanbingjing: L('mirror', '#d8f4ff', '#5a8aa8', '200,240,255'),
  art_tianluo: L('ribbon', '#efe2b0', '#a08030', '255,235,160'),
  art_zhenyue: L('mountain', '#a08860', '#4a3a20', '240,210,140'),
  art_xuehun: L('bonebanner', '#a02030', '#3a0a10', '255,60,80'),
  // —— 其它
  item_bottle: L('bottle', '#3f6a4a', '#9ad8a8', '140,255,180'),
  tal_tianleizi: L('bead', '#2a2a34', '#c8d0ff', '170,190,255'),
  tal_fubao: L('talisman', '#f0dc90', '#c0901a', '255,220,120'),
};

/** 未登记的法器按类型给一个默认外观 */
export function artLook(id: string, kind?: string, color?: string): ArtLook {
  const l = ART_LOOK[id] ?? GEN_LOOK[id];
  if (l) return l;
  const c = color ?? '#c0c8c0';
  const map: Record<string, ArtShape> = { sword: 'jian', needle: 'needle', ring: 'ring', mirror: 'mirror', slam: 'brick', arrow: 'thorn', bell: 'bell', bind: 'ribbon', flame: 'flame', banner: 'banner', cauldron: 'ding', shield: 'shield', armor: 'armor', wings: 'wings', flight: 'boat', boots: 'boots', gourd: 'gourd', umbrella: 'umbrella', fan: 'fan', beads: 'bead', cover: 'cover', pagoda: 'pagoda', seal: 'seal', lamp: 'lamp', shuttle: 'shuttle', whip: 'whip', disk: 'disk', puppet: 'puppet' };
  return L(map[kind ?? 'sword'] ?? 'jian', c, '#6a5a40', '220,230,220');
}
