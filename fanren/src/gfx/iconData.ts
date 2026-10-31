// 第二十三步：物品图标（外部 AI 绘制，96px，data URL 内联；tools/propconvert.ts 生成）
const i0 = './game-assets/icons/egg_huli.webp';
const i1 = './game-assets/icons/egg_jiao.webp';
const i2 = './game-assets/icons/egg_shijin.webp';
const i3 = './game-assets/icons/egg_wolf.webp';
const i4 = './game-assets/icons/egg_yunchi.webp';
const i5 = './game-assets/icons/gift_fan.webp';
const i6 = './game-assets/icons/gift_hairpin.webp';
const i7 = './game-assets/icons/gift_sachet.webp';
const i8 = './game-assets/icons/herb_bingpo.webp';
const i9 = './game-assets/icons/herb_huangjing.webp';
const i10 = './game-assets/icons/herb_huolong.webp';
const i11 = './game-assets/icons/herb_jinxin.webp';
const i12 = './game-assets/icons/herb_jiuqu.webp';
const i13 = './game-assets/icons/herb_lingzhi.webp';
const i14 = './game-assets/icons/herb_nichang.webp';
const i15 = './game-assets/icons/herb_tianling.webp';
const i16 = './game-assets/icons/herb_xuejing.webp';
const i17 = './game-assets/icons/herb_xuelian.webp';
const i18 = './game-assets/icons/herb_yangshen.webp';
const i19 = './game-assets/icons/herb_zihou.webp';
const i20 = './game-assets/icons/item_bottle.webp';
const i21 = './game-assets/icons/item_moletter.webp';
const i22 = './game-assets/icons/item_nuanyang.webp';
const i23 = './game-assets/icons/item_qingxi.webp';
const i24 = './game-assets/icons/item_qinpu.webp';
const i25 = './game-assets/icons/item_shengxian.webp';
const i26 = './game-assets/icons/item_yuanqi.webp';
const i27 = './game-assets/icons/mat_bingjialin.webp';
const i28 = './game-assets/icons/mat_chihuolin.webp';
const i29 = './game-assets/icons/mat_chitong.webp';
const i30 = './game-assets/icons/mat_dujiaolin.webp';
const i31 = './game-assets/icons/mat_gengjing.webp';
const i32 = './game-assets/icons/mat_gubaocan.webp';
const i33 = './game-assets/icons/mat_heilin.webp';
const i34 = './game-assets/icons/mat_huochan.webp';
const i35 = './game-assets/icons/mat_jinleizhu.webp';
const i36 = './game-assets/icons/mat_leipenggu.webp';
const i37 = './game-assets/icons/mat_lingquan.webp';
const i38 = './game-assets/icons/mat_lingshi.webp';
const i39 = './game-assets/icons/mat_mangpi.webp';
const i40 = './game-assets/icons/mat_mojiaoqi.webp';
const i41 = './game-assets/icons/mat_mojiaozhao.webp';
const i42 = './game-assets/icons/mat_qianmuyan.webp';
const i43 = './game-assets/icons/mat_qingfengjiao.webp';
const i44 = './game-assets/icons/mat_shisha.webp';
const i45 = './game-assets/icons/mat_shuanggongdu.webp';
const i46 = './game-assets/icons/mat_shuangtongmu.webp';
const i47 = './game-assets/icons/mat_tiejing.webp';
const i48 = './game-assets/icons/mat_tujiapi.webp';
const i49 = './game-assets/icons/mat_xuantie.webp';
const i50 = './game-assets/icons/mat_xuanyu.webp';
const i51 = './game-assets/icons/mat_xueyan.webp';
const i52 = './game-assets/icons/mat_yanghunmu.webp';
const i53 = './game-assets/icons/mat_yaodan1.webp';
const i54 = './game-assets/icons/mat_yaodan10.webp';
const i55 = './game-assets/icons/mat_yaodan2.webp';
const i56 = './game-assets/icons/mat_yaodan3.webp';
const i57 = './game-assets/icons/mat_yaodan4.webp';
const i58 = './game-assets/icons/mat_yaodan5.webp';
const i59 = './game-assets/icons/mat_yaodan6.webp';
const i60 = './game-assets/icons/mat_yaodan7.webp';
const i61 = './game-assets/icons/mat_yaodan8.webp';
const i62 = './game-assets/icons/mat_yaodan9.webp';
const i63 = './game-assets/icons/mat_yinchi.webp';
const i64 = './game-assets/icons/mat_yinzhima.webp';
const i65 = './game-assets/icons/mat_yuanhun.webp';
const i66 = './game-assets/icons/mat_yunchiyu.webp';
const i67 = './game-assets/icons/mat_zhijiao.webp';
const i68 = './game-assets/icons/pill_biyan.webp';
const i69 = './game-assets/icons/pill_butian.webp';
const i70 = './game-assets/icons/pill_dingyan.webp';
const i71 = './game-assets/icons/pill_huanglong.webp';
const i72 = './game-assets/icons/pill_huiqi.webp';
const i73 = './game-assets/icons/pill_jiangchen.webp';
const i74 = './game-assets/icons/pill_jinsui.webp';
const i75 = './game-assets/icons/pill_jiuqu.webp';
const i76 = './game-assets/icons/pill_juling.webp';
const i77 = './game-assets/icons/pill_juqi.webp';
const i78 = './game-assets/icons/pill_liaoshang.webp';
const i79 = './game-assets/icons/pill_ningyuan.webp';
const i80 = './game-assets/icons/pill_peiying.webp';
const i81 = './game-assets/icons/pill_yanghun.webp';
const i82 = './game-assets/icons/pill_yanshou.webp';
const i83 = './game-assets/icons/pill_zhuji.webp';
const i84 = './game-assets/icons/scroll_alchemy.webp';
const i85 = './game-assets/icons/scroll_array.webp';
const i86 = './game-assets/icons/scroll_devil.webp';
const i87 = './game-assets/icons/scroll_earth.webp';
const i88 = './game-assets/icons/scroll_fire.webp';
const i89 = './game-assets/icons/scroll_ghost.webp';
const i90 = './game-assets/icons/scroll_gongfa_high.webp';
const i91 = './game-assets/icons/scroll_gongfa_low.webp';
const i92 = './game-assets/icons/scroll_gongfa_mid.webp';
const i93 = './game-assets/icons/scroll_ice.webp';
const i94 = './game-assets/icons/scroll_metal.webp';
const i95 = './game-assets/icons/scroll_puppet.webp';
const i96 = './game-assets/icons/scroll_sword.webp';
const i97 = './game-assets/icons/scroll_thunder.webp';
const i98 = './game-assets/icons/scroll_water.webp';
const i99 = './game-assets/icons/scroll_wind.webp';
const i100 = './game-assets/icons/scroll_wood.webp';
const i101 = './game-assets/icons/tal_ancient.webp';
const i102 = './game-assets/icons/tal_blank.webp';
const i103 = './game-assets/icons/tal_fubao.webp';
const i104 = './game-assets/icons/tal_high.webp';
const i105 = './game-assets/icons/tal_low_atk.webp';
const i106 = './game-assets/icons/tal_low_def.webp';
const i107 = './game-assets/icons/tal_low_move.webp';
const i108 = './game-assets/icons/tal_mid_atk.webp';
const i109 = './game-assets/icons/tal_mid_def.webp';
const i110 = './game-assets/icons/tok_danuoyi.webp';
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
