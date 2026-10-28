// 第 4 阶段（s4-content）：第二层——势力
import type { FactionDef } from './types';

export const FACTIONS: Record<string, FactionDef> = {
  zhengdao: { id: 'zhengdao', name: '正道盟', region: 'tiannan', desc: '天南正道宗门的盟约，越国七派南迁后亦归其中。' },
  yue7: { id: 'yue7', name: '越国七派', region: 'tiannan', desc: '黄枫谷、掩月宗、灵兽山、清虚门、化刀坞、天阙堡、巨剑门，分守越国七处灵脉。' },
  tiandao: { id: 'tiandao', name: '天道盟', region: 'tiannan', desc: '落云宗、古剑门、百巧院三派结盟，介于正魔之间。' },
  modao6: { id: 'modao6', name: '魔道六宗', region: 'tiannan', evil: true, desc: '鬼灵门、合欢宗、御灵宗、千幻宗、天煞宗、阴罗宗，天南魔道的六根柱子。' },
  jiuguo: { id: 'jiuguo', name: '九国盟', region: 'tiannan', desc: '天南北部九国为抵御慕兰法士结成的同盟，化意门为盟主，千竹教亦在其列。' },
  mulan: { id: 'mulan', name: '慕兰法士', region: 'tiannan', desc: '草原上的法士部族，与九国盟连年交战。' },
  xinggong: { id: 'xinggong', name: '星宫', region: 'luanxing', desc: '天星双圣坐镇天星城，统御内星海数百年。' },
  nixing: { id: 'nixing', name: '逆星盟', region: 'luanxing', evil: true, desc: '不服星宫的散修与魔修结成的同盟。' },
  luanxing_s: { id: 'luanxing_s', name: '海外诸岛', region: 'luanxing', desc: '妙音门、极阴岛等各据一岛的门派。' },
  jin_zheng: { id: 'jin_zheng', name: '大晋正道', region: 'dajin', desc: '太一门、叶家等正道宗门世家。' },
  jin_mo: { id: 'jin_mo', name: '大晋魔道十宗', region: 'dajin', evil: true, desc: '以天魔宗为首，化神老怪坐镇。' },
  tianlan: { id: 'tianlan', name: '天澜圣殿', region: 'dajin', desc: '慕兰法士的圣地，供奉天澜圣兽。' },
};
