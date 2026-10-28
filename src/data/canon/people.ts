// 第 4 阶段（s4-content）：第四层——人物。原著有名有姓者配本命法宝与招牌神通。
// 本命法宝杀之必得（npc.ts 的 TREASURE 表已接上第一批）；招牌神通：他与你为敌时会使出来（schools.ts），
// 杀了他也能从遗物里参悟（其玉简掉落）。
import type { PersonDef } from './types';

export const PEOPLE: PersonDef[] = [
  // —— 第一批（任务书点名）
  { id: 'b_nangongwan', name: '南宫婉', sect: 'yanyue', title: '掩月宗结丹长老', treasure: ['art_zhuque', 'art_zhuxie'], sig: 'hanyue', gongfa: 'suonv', line: '素女轮回功修到深处，朱雀环一转便是一片火海。' },
  { id: 'wentianren', name: '温天仁', sect: 'nixing', title: '六道极圣之徒', treasure: ['art_tianyang'], sig: 'jinwu', gongfa: 'nixingjing', line: '天阳鎏金针出手如九日同照，乱星海结丹中难逢敌手。' },
  { id: 'manhuzi', name: '蛮胡子', sect: 'nixing', title: '逆星盟元婴魔修', treasure: ['art_zibing', 'art_huanglin'], sig: 'tuotian', gongfa: 'tuotian', line: '托天魔功肉身硬抗法宝，紫冰镯寒气逼人。' },
  { id: 'liudao', name: '六道极圣', sect: 'nixing', title: '乱星海魔道巨擘', treasure: ['art_sanshen', 'art_p_wanhun'], sig: 'wangui', gongfa: 'nixingjing', line: '三神白骨幡一展，白骨魔神破空而出。' },
  { id: 'qianlaomo', name: '乾老魔', sect: 'nixing', title: '昆吾山旧客、元婴魔修', treasure: ['art_wuzi'], sig: 'mosha', gongfa: 'jiuyoulian', line: '五子同心魔，五只魔头皆有元婴之力。' },
  { id: 'jiyin', name: '极阴祖师', sect: 'jiyin', title: '极阴岛岛主', treasure: ['art_tiandu'], sig: 'xueyingdun', gongfa: 'xuanyin', line: '天都尸火所过，生机断绝；血影遁一走三千丈。' },
  // —— 天南
  { id: 'lihuayuan', name: '李化元', sect: 'huangfeng', title: '黄枫谷结丹长老', treasure: [], sig: 'qingyuanmang', gongfa: 'qingyuan', line: '韩立的师尊，青元剑诀一脉。' },
  { id: 'hongfu', name: '红拂', sect: 'huangfeng', title: '黄枫谷长老', treasure: [], sig: 'huolong', gongfa: 'lihuojing', line: '火法刚烈，性子更烈。' },
  { id: 'nichang', name: '霓裳仙子', sect: 'yanyue', title: '掩月宗掌门', treasure: ['art_xuehongling'], sig: 'bingposuo', gongfa: 'suonv', line: '雪虹绫一缠，结丹修士也要挣扎半晌。' },
  { id: 'wangchan', name: '王蝉', sect: 'guiling', title: '鬼灵门少主', treasure: [], sig: 'guiku', gongfa: 'guilingjing', line: '血灵大法阴毒狠辣，鬼哭声中取人性命。' },
  { id: 'wangtiangu', name: '王天古', sect: 'guiling', title: '鬼灵门门主', treasure: ['art_zhenhaizhong'], sig: 'wangui', gongfa: 'guilingjing', line: '鬼灵门元婴老怪，镇海钟一响神魂失守。' },
  { id: 'hehuanlaomo', name: '合欢老魔', sect: 'hehuan', title: '合欢宗元婴老怪', treasure: ['art_jingangzhao'], sig: 'shehun', gongfa: 'chanv', line: '摄魂真言一出，结丹修士当场失神。' },
  { id: 'tianku', name: '天哭老人', sect: 'yinluo', title: '阴罗宗太上长老', treasure: ['art_guiluo'], sig: 'lianhunying', gongfa: 'yinluo', line: '鬼罗幡中万鬼齐哭。' },
  { id: 'chengtiankun', name: '程天坤', sect: 'luoyun', title: '落云宗大长老', treasure: ['art_balingchi'], sig: 'jianmu', gongfa: 'yimu', line: '落云宗元婴大长老，八灵尺镇压一方。' },
  { id: 'jiangyun', name: '姜云', sect: 'gujian', title: '古剑门结丹剑修', treasure: ['art_guanrijian'], sig: 'baihong', gongfa: 'gujianjing', line: '一剑白虹，古剑门年轻一辈第一人。' },
  { id: 'fuyunzi', name: '浮云子', sect: 'qingxu', title: '清虚门结丹长老', treasure: ['art_qingmingzhen'], sig: 'wulei', gongfa: 'qingxujue', line: '五雷正法，雷落如雨。' },
  { id: 'wuchi', name: '武痴', sect: 'jujian', title: '巨剑门结丹长老', treasure: ['art_qianchongfeng'], sig: 'jianlun', gongfa: 'jujianjue', line: '一生只练剑，剑轮护体，千重峰压顶。' },
  { id: 'hantianya', name: '寒天涯', sect: 'huadao', title: '化刀坞结丹长老', treasure: ['art_molongren'], sig: 'duanjin', gongfa: 'huadaojue', line: '魔龙刃饮血越多越凶。' },
  // —— 乱星海 / 大晋
  { id: 'xuangu', name: '玄骨上人', sect: 'jiyin', title: '极阴岛旧主', treasure: ['art_miemo'], sig: 'yinshi', gongfa: 'xuanyin', line: '夺舍重生的老魔，灭魔箭专克同类。' },
  { id: 'qingyi', name: '青易居士', sect: 'xinggong', title: '碧灵岛散修', treasure: ['art_qingmingzhen'], sig: 'canglang', gongfa: 'zhenhai', line: '九枚青冥针，结丹修士亦忌惮。' },
  { id: 'zhuoruting', name: '卓如婷', sect: 'miaoyin', title: '妙音门弟子', treasure: [], sig: 'my_qinyin', gongfa: 'miaoyinjue', line: '琴音一起，杀机四伏。' },
  { id: 'xuanqingzi', name: '玄青子', sect: 'taiyi', title: '太一门元婴长老', treasure: ['art_tianajian'], sig: 'ty_huaqing', gongfa: 'taiyijue', line: '天阿神剑剑气纵横三千丈。' },
  { id: 'qimiao', name: '七妙真人', sect: 'tianmo', title: '天魔宗长老', treasure: ['art_xueleizi'], sig: 'mosha', gongfa: 'tianmojing', line: '血雷子一炸，护体灵光也挡不住。' },
];
export const PERSON_BY_ID: Record<string, PersonDef> = Object.fromEntries(PEOPLE.map((p) => [p.id, p]));
