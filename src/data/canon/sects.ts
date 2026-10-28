// 第 4 阶段（s4-content）：第三层——宗门。每派有镇派功法、门中法术、弟子常用法器、镇宗之宝（不外卖）。
// id 与地点 id、schools.ts 的流派 id 一致；先把天南做透，乱星海、大晋给出骨架与特色。
import type { SectDef } from './types';
import { SECT_GEAR, SECT_TREASURE } from './artgen';

type Row = Omit<SectDef, 'gear' | 'treasure'> & { gear?: string[]; treasure?: string };
const S: Row[] = [
  // —— 天南 · 越国七派
  { id: 'huangfeng', name: '黄枫谷', region: 'tiannan', faction: 'yue7', wx: 'wood', gongfa: 'qingyuan', arts: ['qingyuanmang', 'yujian', 'huoshe', 'chiyan', 'hutijiandun', 'jinren'], extra: ['danjie', 'fujie'], gear: ['art_fengyunfan'], desc: '越国七派之一，剑修与火法并重，李化元一脉。' },
  { id: 'yanyue', name: '掩月宗', region: 'tiannan', faction: 'yue7', wx: 'water', gongfa: 'suonv', arts: ['bingzhui', 'hanxing', 'hanyue', 'xuanbing', 'shuidan', 'mihun'], extra: ['ningshen'], desc: '越国七派之首，女修众多，冰水法术见长。' },
  { id: 'lingshou', name: '灵兽山', region: 'tiannan', faction: 'yue7', wx: 'wood', gongfa: 'wanling', arts: ['yushou', 'qulingfeng', 'tengfu', 'feisha'], extra: ['yushoujue'], desc: '驭兽养虫，人未到，兽先到。' },
  { id: 'qingxu', name: '清虚门', region: 'tiannan', faction: 'yue7', wx: 'thunder', gongfa: 'qingxujue', arts: ['leilian', 'wulei', 'yufeng', 'huichun', 'dingshen'], extra: ['fujie'], desc: '道家清修，雷法专克鬼物。' },
  { id: 'huadao', name: '化刀坞', region: 'tiannan', faction: 'yue7', wx: 'metal', gongfa: 'huadaojue', arts: ['duanjin', 'jinren', 'fenjin', 'qingfeng'], desc: '以刀修闻名，飞刃成套。' },
  { id: 'tianque', name: '天阙堡', region: 'tiannan', faction: 'yue7', wx: 'earth', gongfa: 'tianquegf', arts: ['tujia', 'shanbeng', 'tiebu', 'jinzhong', 'feishi'], extra: ['tongpi'], desc: '堡垒森严，土法炼体，守多于攻。' },
  { id: 'jujian', name: '巨剑门', region: 'tiannan', faction: 'yue7', wx: 'metal', gongfa: 'jujianjue', arts: ['jianlun', 'yujian', 'jujianshu', 'jianhe'], desc: '门人多使巨剑，以力御剑。' },
  { id: 'qixuan', name: '七玄门', region: 'tiannan', faction: 'yue7', wx: 'none', gongfa: 'qixuanxin', arts: ['bengquan', 'zhayan', 'jifeng', 'nifeng'], desc: '镜州彩霞山上的江湖门派，韩立少年时的出身。' },
  // —— 天南 · 天道盟
  { id: 'luoyun', name: '落云宗', region: 'tiannan', faction: 'tiandao', wx: 'wood', gongfa: 'yimu', arts: ['qingmuci', 'tengman', 'huichun', 'qingteng', 'yimu', 'qingmu'], extra: ['baicao', 'danjie'], desc: '灵药园闻名天南，木法生机绵长。' },
  { id: 'gujian', name: '古剑门', region: 'tiannan', faction: 'tiandao', wx: 'metal', gongfa: 'gujianjing', arts: ['liuguang', 'baihong', 'jianying', 'yujian'], desc: '剑修圣地。' },
  { id: 'baiqiao', name: '百巧院', region: 'tiannan', faction: 'tiandao', wx: 'metal', gongfa: 'baiqiaojue', arts: ['jinjiakui', 'baguazhen', 'kunzhen', 'diandao'], extra: ['kuileishu', 'jiguanpu', 'zhenjie'], desc: '擅炼傀儡机关、布阵。' },
  // —— 天南 · 九国盟 / 千竹教 / 慕兰
  { id: 'huayi', name: '化意门', region: 'tiannan', faction: 'jiuguo', wx: 'wood', gongfa: 'huayijing', arts: ['duzhang', 'wandu', 'tengfu'], extra: ['danjie'], desc: '九国盟盟主宗门，毒道一绝。' },
  { id: 'qianzhu', name: '千竹教', region: 'tiannan', faction: 'jiuguo', wx: 'metal', gongfa: 'qianzhujing', arts: ['kuilei', 'jinjiakui', 'shishen', 'kunzhen'], extra: ['dayan', 'dayankui'], desc: '大衍神君所创，傀儡之术独步人界。' },
  { id: 'mulan', name: '慕兰法士', region: 'tiannan', faction: 'mulan', wx: 'wind', gongfa: 'mulandian', arts: ['xunfeng', 'kuangfeng', 'longjuan'], desc: '草原法士，巽风为用。' },
  // —— 天南 · 魔道六宗
  { id: 'guiling', name: '鬼灵门', region: 'tiannan', faction: 'modao6', wx: 'yin', evil: true, gongfa: 'guilingjing', arts: ['yinshazhang', 'guiku', 'yinhun', 'shihun', 'xueying'], extra: ['ms_xuedun'], desc: '驭使鬼物，王蝉一脉。' },
  { id: 'hehuan', name: '合欢宗', region: 'tiannan', faction: 'modao6', wx: 'yin', evil: true, gongfa: 'chanv', arts: ['shehun', 'mihun', 'yinhun'], desc: '双修采补，媚术摄魂。' },
  { id: 'yuling', name: '御灵宗', region: 'tiannan', faction: 'modao6', wx: 'yin', evil: true, gongfa: 'xueji', arts: ['duchong', 'shixue', 'yushou'], extra: ['yulingjing'], desc: '血祭灵兽，兽凶人狂。' },
  { id: 'qianhuan', name: '千幻宗', region: 'tiannan', faction: 'modao6', wx: 'wind', evil: true, gongfa: 'qianhuanjue', arts: ['huanying', 'qh_qianhuan', 'yingdun', 'mihun'], desc: '幻术见长，真假难辨。' },
  { id: 'tiansha', name: '天煞宗', region: 'tiannan', faction: 'modao6', wx: 'yin', evil: true, gongfa: 'xuesha', arts: ['xuefeng', 'xueyan', 'xuehe', 'xuedun'], extra: ['ms_ranxue', 'ms_xuedun'], desc: '杀伐果决，血煞冲天。' },
  { id: 'yinluo', name: '阴罗宗', region: 'tiannan', faction: 'modao6', wx: 'yin', evil: true, gongfa: 'yinluo', arts: ['lianhunying', 'yinfeng', 'xuelian'], treasure: 'art_guiluo', desc: '镇宗之宝鬼罗幡以数十万生魂祭炼。' },
  // —— 乱星海
  { id: 'xinggong', name: '星宫', region: 'luanxing', faction: 'xinggong', wx: 'metal', gongfa: 'xingchen', arts: ['xg_xingguang', 'zhoutianzhen', 'jinguangzhen', 'leichizhen'], extra: ['zhoutiantu', 'diandaopu'], desc: '天星双圣坐镇，阵法星术冠绝乱星海。' },
  { id: 'miaoyin', name: '妙音门', region: 'luanxing', faction: 'luanxing_s', wx: 'wind', gongfa: 'miaoyinjue', arts: ['my_qinyin', 'luohunyin', 'baihua', 'liufeng'], desc: '音律与媚术并修，紫灵仙子出身于此。' },
  { id: 'jiyin', name: '极阴岛', region: 'luanxing', faction: 'luanxing_s', wx: 'yin', evil: true, gongfa: 'xuanyin', arts: ['yinshi', 'xueyingdun', 'yinhun', 'xuanbing'], extra: ['ms_xueying'], desc: '极阴祖师的老巢，乱星海魔道重地。' },
  { id: 'nixing', name: '逆星盟', region: 'luanxing', faction: 'nixing', wx: 'yin', evil: true, gongfa: 'nixingjing', arts: ['nx_nixue', 'xueshachong', 'huaxuedao'], extra: ['ms_huaxue'], desc: '与星宫作对的魔修同盟。' },
  // —— 大晋
  { id: 'taiyi', name: '太一门', region: 'dajin', faction: 'jin_zheng', wx: 'metal', gongfa: 'taiyijue', arts: ['ty_huaqing', 'wanjian', 'baihong', 'jianxin'], treasure: 'art_tianajian', desc: '大晋正道大派，剑气纵横。' },
  { id: 'tianmo', name: '天魔宗', region: 'dajin', faction: 'jin_mo', wx: 'yin', evil: true, gongfa: 'tianmojing', arts: ['wangui', 'mosha', 'xuelian', 'jieti'], extra: ['ms_jieti', 'tuotian'], desc: '大晋魔道十宗之首，化神老怪坐镇。' },
  { id: 'tianlan', name: '天澜圣殿', region: 'dajin', faction: 'tianlan', wx: 'wind', gongfa: 'tianlandian', arts: ['tl_shenguang', 'hualong', 'xunfeng'], desc: '供奉天澜圣兽的圣殿。' },
];
export const SECTS: Record<string, SectDef> = Object.fromEntries(S.map((s) => [s.id, { ...s, gear: [...(s.gear ?? []), ...(SECT_GEAR[s.id] ?? [])], treasure: s.treasure ?? SECT_TREASURE[s.id] ?? '' } as SectDef]));
export const SECT_LIST = Object.values(SECTS);
