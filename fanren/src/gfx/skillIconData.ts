// 第二十四步：法术图标（外部 AI 绘制，96px；tools/vfxconvert.ts 生成，勿手改）
const s0 = './game-assets/skills/bingpo.webp';
const s1 = './game-assets/skills/bingzhui.webp';
const s2 = './game-assets/skills/bixie.webp';
const s3 = './game-assets/skills/chunli.webp';
const s4 = './game-assets/skills/dageng.webp';
const s5 = './game-assets/skills/dayanchong.webp';
const s6 = './game-assets/skills/diandao.webp';
const s7 = './game-assets/skills/dici.webp';
const s8 = './game-assets/skills/dongxuan.webp';
const s9 = './game-assets/skills/fengleichi.webp';
const s10 = './game-assets/skills/fengren.webp';
const s11 = './game-assets/skills/hanbing.webp';
const s12 = './game-assets/skills/huichun.webp';
const s13 = './game-assets/skills/huodan.webp';
const s14 = './game-assets/skills/huoqiufu.webp';
const s15 = './game-assets/skills/huoshe.webp';
const s16 = './game-assets/skills/huoya.webp';
const s17 = './game-assets/skills/hutijiandun.webp';
const s18 = './game-assets/skills/jianying.webp';
const s19 = './game-assets/skills/jifeng.webp';
const s20 = './game-assets/skills/jingang.webp';
const s21 = './game-assets/skills/jinganghou.webp';
const s22 = './game-assets/skills/jingshen.webp';
const s23 = './game-assets/skills/jinlei.webp';
const s24 = './game-assets/skills/jujianshu.webp';
const s25 = './game-assets/skills/juling.webp';
const s26 = './game-assets/skills/kuilei.webp';
const s27 = './game-assets/skills/kunzhen.webp';
const s28 = './game-assets/skills/leidun.webp';
const s29 = './game-assets/skills/leiwang.webp';
const s30 = './game-assets/skills/lianxi.webp';
const s31 = './game-assets/skills/lieyan.webp';
const s32 = './game-assets/skills/liusha.webp';
const s33 = './game-assets/skills/luoyan.webp';
const s34 = './game-assets/skills/mingwang.webp';
const s35 = './game-assets/skills/nifeng.webp';
const s36 = './game-assets/skills/nongyan.webp';
const s37 = './game-assets/skills/qianlan.webp';
const s38 = './game-assets/skills/qijin.webp';
const s39 = './game-assets/skills/qingpan.webp';
const s40 = './game-assets/skills/qingteng.webp';
const s41 = './game-assets/skills/qingyuanmang.webp';
const s42 = './game-assets/skills/quhun.webp';
const s43 = './game-assets/skills/sanyuan.webp';
const s44 = './game-assets/skills/shengmo.webp';
const s45 = './game-assets/skills/shijin.webp';
const s46 = './game-assets/skills/shuilong.webp';
const s47 = './game-assets/skills/tengfu.webp';
const s48 = './game-assets/skills/tianleifu.webp';
const s49 = './game-assets/skills/tihun.webp';
const s50 = './game-assets/skills/tishen.webp';
const s51 = './game-assets/skills/tudun.webp';
const s52 = './game-assets/skills/waifang.webp';
const s53 = './game-assets/skills/wuzi.webp';
const s54 = './game-assets/skills/xiangjia.webp';
const s55 = './game-assets/skills/xuanbing.webp';
const s56 = './game-assets/skills/xuanfeng.webp';
const s57 = './game-assets/skills/xuedun.webp';
const s58 = './game-assets/skills/xuelian.webp';
const s59 = './game-assets/skills/xueying.webp';
const s60 = './game-assets/skills/xueyingdun.webp';
const s61 = './game-assets/skills/xutianding.webp';
const s62 = './game-assets/skills/yanjia.webp';
const s63 = './game-assets/skills/yimu.webp';
const s64 = './game-assets/skills/yinhun.webp';
const s65 = './game-assets/skills/yinlei.webp';
const s66 = './game-assets/skills/yuanci.webp';
const s67 = './game-assets/skills/yufeng.webp';
const s68 = './game-assets/skills/yujian.webp';
const s69 = './game-assets/skills/yushou.webp';
const s70 = './game-assets/skills/zhangxin.webp';
const s71 = './game-assets/skills/zhayan.webp';
export const SKILL_ICON: Record<string, string> = {
  bingpo: s0,
  bingzhui: s1,
  bixie: s2,
  chunli: s3,
  dageng: s4,
  dayanchong: s5,
  diandao: s6,
  dici: s7,
  dongxuan: s8,
  fengleichi: s9,
  fengren: s10,
  hanbing: s11,
  huichun: s12,
  huodan: s13,
  huoqiufu: s14,
  huoshe: s15,
  huoya: s16,
  hutijiandun: s17,
  jianying: s18,
  jifeng: s19,
  jingang: s20,
  jinganghou: s21,
  jingshen: s22,
  jinlei: s23,
  jujianshu: s24,
  juling: s25,
  kuilei: s26,
  kunzhen: s27,
  leidun: s28,
  leiwang: s29,
  lianxi: s30,
  lieyan: s31,
  liusha: s32,
  luoyan: s33,
  mingwang: s34,
  nifeng: s35,
  nongyan: s36,
  qianlan: s37,
  qijin: s38,
  qingpan: s39,
  qingteng: s40,
  qingyuanmang: s41,
  quhun: s42,
  sanyuan: s43,
  shengmo: s44,
  shijin: s45,
  shuilong: s46,
  tengfu: s47,
  tianleifu: s48,
  tihun: s49,
  tishen: s50,
  tudun: s51,
  waifang: s52,
  wuzi: s53,
  xiangjia: s54,
  xuanbing: s55,
  xuanfeng: s56,
  xuedun: s57,
  xuelian: s58,
  xueying: s59,
  xueyingdun: s60,
  xutianding: s61,
  yanjia: s62,
  yimu: s63,
  yinhun: s64,
  yinlei: s65,
  yuanci: s66,
  yufeng: s67,
  yujian: s68,
  yushou: s69,
  zhangxin: s70,
  zhayan: s71,
};
