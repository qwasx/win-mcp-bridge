// 第二十三步：物品图标（外部 AI 绘制）——按物品 id 找图；符箓、功法卷轴按流派归到同一套图
import { ICON_SRC } from './iconData';
import { ARTS } from '../data/arts';

const TAL: Record<string, string> = {
  tal_fire: 'tal_low_atk', tal_ice: 'tal_low_atk', tal_thunder: 'tal_mid_atk', tal_liuding: 'tal_high',
  tal_jingang: 'tal_mid_def', tal_tishen: 'tal_low_def', tal_huifu: 'tal_low_def', tal_escape: 'tal_low_move',
  tal_pojin: 'tal_ancient', tal_fubao: 'tal_fubao',
};
const SCROLL: Record<string, string> = {
  scroll_changchun: 'scroll_gongfa_low', scroll_qingyuan: 'scroll_sword', scroll_xuanyin: 'scroll_ghost', scroll_tuotian: 'scroll_devil',
  scroll_dayan: 'scroll_gongfa_high', scroll_huodan: 'scroll_fire', scroll_bingzhui: 'scroll_ice', scroll_tianyan: 'scroll_gongfa_mid',
  scroll_lianqi: 'scroll_alchemy', scroll_luoyan: 'scroll_wind', scroll_mingqing: 'scroll_water', scroll_leidian: 'scroll_thunder', scroll_yuanci: 'scroll_metal',
};
const SCHOOL: Record<string, string> = {
  体: 'scroll_earth', 冰: 'scroll_ice', 剑: 'scroll_sword', 土: 'scroll_earth', 御: 'scroll_metal', 木: 'scroll_wood', 火: 'scroll_fire',
  符: 'scroll_array', 识: 'scroll_gongfa_mid', 身: 'scroll_wind', 阵: 'scroll_array', 雷: 'scroll_thunder', 风: 'scroll_wind', 魔: 'scroll_devil',
};
const memo = new Map<string, string | null>();

/** 物品的绘制图标（data URL）；没有则 null（退回代码图标或字形） */
export function paintedIcon(id: string): string | null {
  if (memo.has(id)) return memo.get(id)!;
  let k: string | undefined = ICON_SRC[id] ? id : TAL[id] ?? SCROLL[id];
  if (!k && id.startsWith('scroll_art_')) { const a = (ARTS as any)[id.slice(11)] as { school: string } | undefined; k = a ? SCHOOL[a.school] ?? 'scroll_gongfa_mid' : 'scroll_gongfa_mid'; }
  if (!k && id.startsWith('scroll_')) k = 'scroll_gongfa_mid';
  const u = k ? ICON_SRC[k] ?? null : null;
  memo.set(id, u);
  return u;
}
