// 第 4 阶段（s4-content）：第一层——地域（天南 / 乱星海 / 大晋）。各地物产、五行偏向、风物各不相同。
import type { RegionId, Wx } from './types';
import type { Zone } from '../market';

export interface RegionDef {
  id: RegionId; name: string; zones: Zone[];
  /** 五行偏向（生成法器、本地功法的权重） */
  wx: Wx[];
  feature: string;   // 一句话风物
  specialty: string[]; // 本地特色（玩家面板上的“此地出产”说明）
}
export const REGIONS: Record<RegionId, RegionDef> = {
  tiannan: {
    id: 'tiannan', name: '天南', zones: ['yue', 'tiannan', 'mo', 'mulan'], wx: ['wood', 'fire', 'earth', 'metal'],
    feature: '灵草多、宗门林立，正魔两道与天道盟、九国盟犬牙交错；高阶妖兽几近绝迹。',
    specialty: ['越国七派各有制式法器，出了宗门地界便少见', '魔道六宗地界多魔幡、魂灯、血鞭', '百巧院、千竹教一带傀儡阵盘最多', '木火两属法器最常见'],
  },
  luanxing: {
    id: 'luanxing', name: '乱星海', zones: ['luanxing'], wx: ['water', 'ice', 'thunder'],
    feature: '岛屿星罗棋布，星宫与逆星盟对峙；妖兽遍地，妖丹与兽骨法器多，灵药稀少。',
    specialty: ['蛟骨、鲛绡、星砂炼成的水冰两属法器', '星宫阵盘、妙音连珠、极阴魂灯', '外海猎妖修士的粗货便宜耐造'],
  },
  dajin: {
    id: 'dajin', name: '大晋', zones: ['dajin', 'caoyuan'], wx: ['metal', 'yin', 'ice', 'thunder'],
    feature: '人界第一大国，世家宗门盘根错节，魔道十宗势大；货最全，价也最贵。',
    specialty: ['昆吾铁、雪原寒铁炼成的金冰两属法宝', '天魔宗魔塔、太一门清剑、天澜圣印', '元婴老怪的法宝偶尔流到世家子弟手里'],
  },
};
export const ZONE_REGION: Record<Zone, RegionId> = { yue: 'tiannan', tiannan: 'tiannan', mo: 'tiannan', mulan: 'tiannan', luanxing: 'luanxing', dajin: 'dajin', caoyuan: 'dajin' };
