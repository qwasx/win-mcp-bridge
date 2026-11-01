// 第二十三步：物品图标（外部 AI 绘制，96px，data URL 内联；tools/propconvert.ts 生成）
import i0 from '../assets/icons/egg_huli.webp?inline';
import i1 from '../assets/icons/egg_jiao.webp?inline';
import i2 from '../assets/icons/egg_shijin.webp?inline';
import i3 from '../assets/icons/egg_wolf.webp?inline';
import i4 from '../assets/icons/egg_yunchi.webp?inline';
import i5 from '../assets/icons/gift_fan.webp?inline';
import i6 from '../assets/icons/gift_hairpin.webp?inline';
import i7 from '../assets/icons/gift_sachet.webp?inline';
import i8 from '../assets/icons/herb_bingpo.webp?inline';
import i9 from '../assets/icons/herb_huangjing.webp?inline';
import i10 from '../assets/icons/herb_huolong.webp?inline';
import i11 from '../assets/icons/herb_jinxin.webp?inline';
import i12 from '../assets/icons/herb_jiuqu.webp?inline';
import i13 from '../assets/icons/herb_lingzhi.webp?inline';
import i14 from '../assets/icons/herb_nichang.webp?inline';
import i15 from '../assets/icons/herb_tianling.webp?inline';
import i16 from '../assets/icons/herb_xuejing.webp?inline';
import i17 from '../assets/icons/herb_xuelian.webp?inline';
import i18 from '../assets/icons/herb_yangshen.webp?inline';
import i19 from '../assets/icons/herb_zihou.webp?inline';
import i20 from '../assets/icons/item_bottle.webp?inline';
import i21 from '../assets/icons/item_moletter.webp?inline';
import i22 from '../assets/icons/item_nuanyang.webp?inline';
import i23 from '../assets/icons/item_qingxi.webp?inline';
import i24 from '../assets/icons/item_qinpu.webp?inline';
import i25 from '../assets/icons/item_shengxian.webp?inline';
import i26 from '../assets/icons/item_yuanqi.webp?inline';
import i27 from '../assets/icons/mat_bingjialin.webp?inline';
import i28 from '../assets/icons/mat_chihuolin.webp?inline';
import i29 from '../assets/icons/mat_chitong.webp?inline';
import i30 from '../assets/icons/mat_dujiaolin.webp?inline';
import i31 from '../assets/icons/mat_gengjing.webp?inline';
import i32 from '../assets/icons/mat_gubaocan.webp?inline';
import i33 from '../assets/icons/mat_heilin.webp?inline';
import i34 from '../assets/icons/mat_huochan.webp?inline';
import i35 from '../assets/icons/mat_jinleizhu.webp?inline';
import i36 from '../assets/icons/mat_leipenggu.webp?inline';
import i37 from '../assets/icons/mat_lingquan.webp?inline';
import i38 from '../assets/icons/mat_lingshi.webp?inline';
import i39 from '../assets/icons/mat_mangpi.webp?inline';
import i40 from '../assets/icons/mat_mojiaoqi.webp?inline';
import i41 from '../assets/icons/mat_mojiaozhao.webp?inline';
import i42 from '../assets/icons/mat_qianmuyan.webp?inline';
import i43 from '../assets/icons/mat_qingfengjiao.webp?inline';
import i44 from '../assets/icons/mat_shisha.webp?inline';
import i45 from '../assets/icons/mat_shuanggongdu.webp?inline';
import i46 from '../assets/icons/mat_shuangtongmu.webp?inline';
import i47 from '../assets/icons/mat_tiejing.webp?inline';
import i48 from '../assets/icons/mat_tujiapi.webp?inline';
import i49 from '../assets/icons/mat_xuantie.webp?inline';
import i50 from '../assets/icons/mat_xuanyu.webp?inline';
import i51 from '../assets/icons/mat_xueyan.webp?inline';
import i52 from '../assets/icons/mat_yanghunmu.webp?inline';
import i53 from '../assets/icons/mat_yaodan1.webp?inline';
import i54 from '../assets/icons/mat_yaodan10.webp?inline';
import i55 from '../assets/icons/mat_yaodan2.webp?inline';
import i56 from '../assets/icons/mat_yaodan3.webp?inline';
import i57 from '../assets/icons/mat_yaodan4.webp?inline';
import i58 from '../assets/icons/mat_yaodan5.webp?inline';
import i59 from '../assets/icons/mat_yaodan6.webp?inline';
import i60 from '../assets/icons/mat_yaodan7.webp?inline';
import i61 from '../assets/icons/mat_yaodan8.webp?inline';
import i62 from '../assets/icons/mat_yaodan9.webp?inline';
import i63 from '../assets/icons/mat_yinchi.webp?inline';
import i64 from '../assets/icons/mat_yinzhima.webp?inline';
import i65 from '../assets/icons/mat_yuanhun.webp?inline';
import i66 from '../assets/icons/mat_yunchiyu.webp?inline';
import i67 from '../assets/icons/mat_zhijiao.webp?inline';
import i68 from '../assets/icons/pill_biyan.webp?inline';
import i69 from '../assets/icons/pill_butian.webp?inline';
import i70 from '../assets/icons/pill_dingyan.webp?inline';
import i71 from '../assets/icons/pill_huanglong.webp?inline';
import i72 from '../assets/icons/pill_huiqi.webp?inline';
import i73 from '../assets/icons/pill_jiangchen.webp?inline';
import i74 from '../assets/icons/pill_jinsui.webp?inline';
import i75 from '../assets/icons/pill_jiuqu.webp?inline';
import i76 from '../assets/icons/pill_juling.webp?inline';
import i77 from '../assets/icons/pill_juqi.webp?inline';
import i78 from '../assets/icons/pill_liaoshang.webp?inline';
import i79 from '../assets/icons/pill_ningyuan.webp?inline';
import i80 from '../assets/icons/pill_peiying.webp?inline';
import i81 from '../assets/icons/pill_yanghun.webp?inline';
import i82 from '../assets/icons/pill_yanshou.webp?inline';
import i83 from '../assets/icons/pill_zhuji.webp?inline';
import i84 from '../assets/icons/scroll_alchemy.webp?inline';
import i85 from '../assets/icons/scroll_array.webp?inline';
import i86 from '../assets/icons/scroll_devil.webp?inline';
import i87 from '../assets/icons/scroll_earth.webp?inline';
import i88 from '../assets/icons/scroll_fire.webp?inline';
import i89 from '../assets/icons/scroll_ghost.webp?inline';
import i90 from '../assets/icons/scroll_gongfa_high.webp?inline';
import i91 from '../assets/icons/scroll_gongfa_low.webp?inline';
import i92 from '../assets/icons/scroll_gongfa_mid.webp?inline';
import i93 from '../assets/icons/scroll_ice.webp?inline';
import i94 from '../assets/icons/scroll_metal.webp?inline';
import i95 from '../assets/icons/scroll_puppet.webp?inline';
import i96 from '../assets/icons/scroll_sword.webp?inline';
import i97 from '../assets/icons/scroll_thunder.webp?inline';
import i98 from '../assets/icons/scroll_water.webp?inline';
import i99 from '../assets/icons/scroll_wind.webp?inline';
import i100 from '../assets/icons/scroll_wood.webp?inline';
import i101 from '../assets/icons/tal_ancient.webp?inline';
import i102 from '../assets/icons/tal_blank.webp?inline';
import i103 from '../assets/icons/tal_fubao.webp?inline';
import i104 from '../assets/icons/tal_high.webp?inline';
import i105 from '../assets/icons/tal_low_atk.webp?inline';
import i106 from '../assets/icons/tal_low_def.webp?inline';
import i107 from '../assets/icons/tal_low_move.webp?inline';
import i108 from '../assets/icons/tal_mid_atk.webp?inline';
import i109 from '../assets/icons/tal_mid_def.webp?inline';
import i110 from '../assets/icons/tok_danuoyi.webp?inline';
export const ICON_SRC: Record<string, string> = {
  egg_huli: i0,
  egg_jiao: i1,
  egg_shijin: i2,
  egg_wolf: i3,
  egg_yunchi: i4,
  gift_fan: i5,
  gift_hairpin: i6,
  gift_sachet: i7,
  herb_bingpo: i8,
  herb_huangjing: i9,
  herb_huolong: i10,
  herb_jinxin: i11,
  herb_jiuqu: i12,
  herb_lingzhi: i13,
  herb_nichang: i14,
  herb_tianling: i15,
  herb_xuejing: i16,
  herb_xuelian: i17,
  herb_yangshen: i18,
  herb_zihou: i19,
  item_bottle: i20,
  item_moletter: i21,
  item_nuanyang: i22,
  item_qingxi: i23,
  item_qinpu: i24,
  item_shengxian: i25,
  item_yuanqi: i26,
  mat_bingjialin: i27,
  mat_chihuolin: i28,
  mat_chitong: i29,
  mat_dujiaolin: i30,
  mat_gengjing: i31,
  mat_gubaocan: i32,
  mat_heilin: i33,
  mat_huochan: i34,
  mat_jinleizhu: i35,
  mat_leipenggu: i36,
  mat_lingquan: i37,
  mat_lingshi: i38,
  mat_mangpi: i39,
  mat_mojiaoqi: i40,
  mat_mojiaozhao: i41,
  mat_qianmuyan: i42,
  mat_qingfengjiao: i43,
  mat_shisha: i44,
  mat_shuanggongdu: i45,
  mat_shuangtongmu: i46,
  mat_tiejing: i47,
  mat_tujiapi: i48,
  mat_xuantie: i49,
  mat_xuanyu: i50,
  mat_xueyan: i51,
  mat_yanghunmu: i52,
  mat_yaodan1: i53,
  mat_yaodan10: i54,
  mat_yaodan2: i55,
  mat_yaodan3: i56,
  mat_yaodan4: i57,
  mat_yaodan5: i58,
  mat_yaodan6: i59,
  mat_yaodan7: i60,
  mat_yaodan8: i61,
  mat_yaodan9: i62,
  mat_yinchi: i63,
  mat_yinzhima: i64,
  mat_yuanhun: i65,
  mat_yunchiyu: i66,
  mat_zhijiao: i67,
  pill_biyan: i68,
  pill_butian: i69,
  pill_dingyan: i70,
  pill_huanglong: i71,
  pill_huiqi: i72,
  pill_jiangchen: i73,
  pill_jinsui: i74,
  pill_jiuqu: i75,
  pill_juling: i76,
  pill_juqi: i77,
  pill_liaoshang: i78,
  pill_ningyuan: i79,
  pill_peiying: i80,
  pill_yanghun: i81,
  pill_yanshou: i82,
  pill_zhuji: i83,
  scroll_alchemy: i84,
  scroll_array: i85,
  scroll_devil: i86,
  scroll_earth: i87,
  scroll_fire: i88,
  scroll_ghost: i89,
  scroll_gongfa_high: i90,
  scroll_gongfa_low: i91,
  scroll_gongfa_mid: i92,
  scroll_ice: i93,
  scroll_metal: i94,
  scroll_puppet: i95,
  scroll_sword: i96,
  scroll_thunder: i97,
  scroll_water: i98,
  scroll_wind: i99,
  scroll_wood: i100,
  tal_ancient: i101,
  tal_blank: i102,
  tal_fubao: i103,
  tal_high: i104,
  tal_low_atk: i105,
  tal_low_def: i106,
  tal_low_move: i107,
  tal_mid_atk: i108,
  tal_mid_def: i109,
  tok_danuoyi: i110,
};
