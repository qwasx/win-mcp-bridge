// 丹方：主辅药、年份要求、基础成丹率
export interface RecipeInput { id: string; n: number; minAge?: number }
export interface Recipe { id: string; name: string; out: string; outN: number; inputs: RecipeInput[]; base: number; days: number; reqRealm: number; desc: string }

export const RECIPES: Recipe[] = [
  { id: 'r_juqi', name: '聚气丹', out: 'pill_juqi', outN: 1, inputs: [{ id: 'herb_huangjing', n: 2 }], base: 0.6, days: 3, reqRealm: 1, desc: '炼气期常用，增修为、助冲关。' },
  { id: 'r_huiqi', name: '回气丹', out: 'pill_huiqi', outN: 2, inputs: [{ id: 'herb_lingzhi', n: 1 }, { id: 'herb_huangjing', n: 1 }], base: 0.7, days: 2, reqRealm: 1, desc: '迅速恢复法力。' },
  { id: 'r_liaoshang', name: '疗伤丹', out: 'pill_liaoshang', outN: 2, inputs: [{ id: 'herb_jinxin', n: 2 }], base: 0.7, days: 2, reqRealm: 1, desc: '迅速恢复气血。' },
  { id: 'r_huanglong', name: '黄龙丹', out: 'pill_huanglong', outN: 1, inputs: [{ id: 'herb_lingzhi', n: 2, minAge: 50 }, { id: 'herb_jinxin', n: 1 }], base: 0.5, days: 5, reqRealm: 1, desc: '药力浑厚，炼气期大增修为。需五十年以上赤灵芝。' },
  { id: 'r_jinsui', name: '金髓丸', out: 'pill_jinsui', outN: 1, inputs: [{ id: 'herb_jinxin', n: 2, minAge: 60 }, { id: 'herb_huangjing', n: 2, minAge: 60 }, { id: 'mat_lingquan', n: 1 }], base: 0.45, days: 6, reqRealm: 1, desc: '洗练经脉，增加修为。' },
  { id: 'r_dingyan', name: '定颜丹', out: 'pill_dingyan', outN: 1, inputs: [{ id: 'herb_xuelian', n: 1 }, { id: 'herb_huangjing', n: 2, minAge: 30 }], base: 0.4, days: 6, reqRealm: 1, desc: '容颜永驻，女修梦寐以求。' },
  { id: 'r_zhuji', name: '筑基丹', out: 'pill_zhuji', outN: 1, inputs: [{ id: 'herb_zihou', n: 1, minAge: 100 }, { id: 'herb_tianling', n: 1, minAge: 100 }, { id: 'herb_huangjing', n: 3, minAge: 100 }], base: 0.2, days: 10, reqRealm: 1, desc: '冲击筑基必备。主药皆需百年以上药龄——掌天瓶可催熟。' },
  { id: 'r_juling', name: '聚灵丹', out: 'pill_juling', outN: 1, inputs: [{ id: 'herb_xuelian', n: 1, minAge: 100 }, { id: 'herb_lingzhi', n: 2, minAge: 100 }], base: 0.35, days: 8, reqRealm: 2, desc: '筑基期增长修为，冲击小瓶颈。' },
  { id: 'r_yanghun', name: '养魂丹', out: 'pill_yanghun', outN: 1, inputs: [{ id: 'herb_bingpo', n: 1, minAge: 200 }, { id: 'herb_xuejing', n: 1, minAge: 200 }, { id: 'mat_lingquan', n: 2 }], base: 0.25, days: 12, reqRealm: 2, desc: '温养神魂，永久提升神识。' },
];
