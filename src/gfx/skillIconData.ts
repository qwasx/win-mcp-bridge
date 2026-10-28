// 第二十四步：法术图标（外部 AI 绘制，96px；tools/vfxconvert.ts 生成，勿手改）
import s0 from '../assets/skills/bingpo.webp?inline';
import s1 from '../assets/skills/bingzhui.webp?inline';
import s2 from '../assets/skills/bixie.webp?inline';
import s3 from '../assets/skills/chunli.webp?inline';
import s4 from '../assets/skills/dageng.webp?inline';
import s5 from '../assets/skills/dayanchong.webp?inline';
import s6 from '../assets/skills/diandao.webp?inline';
import s7 from '../assets/skills/dici.webp?inline';
import s8 from '../assets/skills/dongxuan.webp?inline';
import s9 from '../assets/skills/fengleichi.webp?inline';
import s10 from '../assets/skills/fengren.webp?inline';
import s11 from '../assets/skills/hanbing.webp?inline';
import s12 from '../assets/skills/huichun.webp?inline';
import s13 from '../assets/skills/huodan.webp?inline';
import s14 from '../assets/skills/huoqiufu.webp?inline';
import s15 from '../assets/skills/huoshe.webp?inline';
import s16 from '../assets/skills/huoya.webp?inline';
import s17 from '../assets/skills/hutijiandun.webp?inline';
import s18 from '../assets/skills/jianying.webp?inline';
import s19 from '../assets/skills/jifeng.webp?inline';
import s20 from '../assets/skills/jingang.webp?inline';
import s21 from '../assets/skills/jinganghou.webp?inline';
import s22 from '../assets/skills/jingshen.webp?inline';
import s23 from '../assets/skills/jinlei.webp?inline';
import s24 from '../assets/skills/jujianshu.webp?inline';
import s25 from '../assets/skills/juling.webp?inline';
import s26 from '../assets/skills/kuilei.webp?inline';
import s27 from '../assets/skills/kunzhen.webp?inline';
import s28 from '../assets/skills/leidun.webp?inline';
import s29 from '../assets/skills/leiwang.webp?inline';
import s30 from '../assets/skills/lianxi.webp?inline';
import s31 from '../assets/skills/lieyan.webp?inline';
import s32 from '../assets/skills/liusha.webp?inline';
import s33 from '../assets/skills/luoyan.webp?inline';
import s34 from '../assets/skills/mingwang.webp?inline';
import s35 from '../assets/skills/nifeng.webp?inline';
import s36 from '../assets/skills/nongyan.webp?inline';
import s37 from '../assets/skills/qianlan.webp?inline';
import s38 from '../assets/skills/qijin.webp?inline';
import s39 from '../assets/skills/qingpan.webp?inline';
import s40 from '../assets/skills/qingteng.webp?inline';
import s41 from '../assets/skills/qingyuanmang.webp?inline';
import s42 from '../assets/skills/quhun.webp?inline';
import s43 from '../assets/skills/sanyuan.webp?inline';
import s44 from '../assets/skills/shengmo.webp?inline';
import s45 from '../assets/skills/shijin.webp?inline';
import s46 from '../assets/skills/shuilong.webp?inline';
import s47 from '../assets/skills/tengfu.webp?inline';
import s48 from '../assets/skills/tianleifu.webp?inline';
import s49 from '../assets/skills/tihun.webp?inline';
import s50 from '../assets/skills/tishen.webp?inline';
import s51 from '../assets/skills/tudun.webp?inline';
import s52 from '../assets/skills/waifang.webp?inline';
import s53 from '../assets/skills/wuzi.webp?inline';
import s54 from '../assets/skills/xiangjia.webp?inline';
import s55 from '../assets/skills/xuanbing.webp?inline';
import s56 from '../assets/skills/xuanfeng.webp?inline';
import s57 from '../assets/skills/xuedun.webp?inline';
import s58 from '../assets/skills/xuelian.webp?inline';
import s59 from '../assets/skills/xueying.webp?inline';
import s60 from '../assets/skills/xueyingdun.webp?inline';
import s61 from '../assets/skills/xutianding.webp?inline';
import s62 from '../assets/skills/yanjia.webp?inline';
import s63 from '../assets/skills/yimu.webp?inline';
import s64 from '../assets/skills/yinhun.webp?inline';
import s65 from '../assets/skills/yinlei.webp?inline';
import s66 from '../assets/skills/yuanci.webp?inline';
import s67 from '../assets/skills/yufeng.webp?inline';
import s68 from '../assets/skills/yujian.webp?inline';
import s69 from '../assets/skills/yushou.webp?inline';
import s70 from '../assets/skills/zhangxin.webp?inline';
import s71 from '../assets/skills/zhayan.webp?inline';
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
