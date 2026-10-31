// 第二十一步：妖兽 / 灵宠 / 召唤物贴图（外部 AI 绘制，已裁边、补实透明度），data URL 内联
const b0 = './game-assets/beasts/amb_deer.webp';
const b1 = './game-assets/beasts/amb_ox.webp';
const b2 = './game-assets/beasts/baigu_king.webp';
const b3 = './game-assets/beasts/baigu_ske.webp';
const b4 = './game-assets/beasts/baize_fish.webp';
const b5 = './game-assets/beasts/biyan.webp';
const b6 = './game-assets/beasts/blackbear.webp';
const b7 = './game-assets/beasts/blood_puppet.webp';
const b8 = './game-assets/beasts/bloodbat.webp';
const b9 = './game-assets/beasts/boar.webp';
const b10 = './game-assets/beasts/centipede.webp';
const b11 = './game-assets/beasts/chitong.webp';
const b12 = './game-assets/beasts/coral_golem.webp';
const b13 = './game-assets/beasts/devil_corpse.webp';
const b14 = './game-assets/beasts/dujiao.webp';
const b15 = './game-assets/beasts/feitian_zombie.webp';
const b16 = './game-assets/beasts/fengxi.webp';
const b17 = './game-assets/beasts/fushou.webp';
const b18 = './game-assets/beasts/ghost_face_spider.webp';
const b19 = './game-assets/beasts/ghost_jellyfish.webp';
const b20 = './game-assets/beasts/gold_puppet.webp';
const b21 = './game-assets/beasts/guijiang.webp';
const b22 = './game-assets/beasts/gumo_xueyan.webp';
const b23 = './game-assets/beasts/heisha_guard.webp';
const b24 = './game-assets/beasts/huajing_shark.webp';
const b25 = './game-assets/beasts/huochan.webp';
const b26 = './game-assets/beasts/ice_worm.webp';
const b27 = './game-assets/beasts/icebear.webp';
const b28 = './game-assets/beasts/iron_crab.webp';
const b29 = './game-assets/beasts/jiguan.webp';
const b30 = './game-assets/beasts/jinbeiyao.webp';
const b31 = './game-assets/beasts/lightning_eel.webp';
const b32 = './game-assets/beasts/lynx.webp';
const b33 = './game-assets/beasts/mangshou.webp';
const b34 = './game-assets/beasts/miasma_toad.webp';
const b35 = './game-assets/beasts/mo_soul.webp';
const b36 = './game-assets/beasts/mojiao.webp';
const b37 = './game-assets/beasts/mtn_ape.webp';
const b38 = './game-assets/beasts/pet_crane.webp';
const b39 = './game-assets/beasts/pet_fox1.webp';
const b40 = './game-assets/beasts/pet_fox2.webp';
const b41 = './game-assets/beasts/pet_fox3.webp';
const b42 = './game-assets/beasts/pet_wolf.webp';
const b43 = './game-assets/beasts/python.webp';
const b44 = './game-assets/beasts/qingfeng.webp';
const b45 = './game-assets/beasts/redwolf.webp';
const b46 = './game-assets/beasts/sand_scorpion.webp';
const b47 = './game-assets/beasts/seaturtle.webp';
const b48 = './game-assets/beasts/shuanggong.webp';
const b49 = './game-assets/beasts/snow_ape.webp';
const b50 = './game-assets/beasts/snow_wolf.webp';
const b51 = './game-assets/beasts/spider.webp';
const b52 = './game-assets/beasts/spirit_fish.webp';
const b53 = './game-assets/beasts/stone_puppet.webp';
const b54 = './game-assets/beasts/sum_motou.webp';
const b55 = './game-assets/beasts/sum_puppet.webp';
const b56 = './game-assets/beasts/sum_qingjiao.webp';
const b57 = './game-assets/beasts/sum_tihun.webp';
const b58 = './game-assets/beasts/swamp_croc.webp';
const b59 = './game-assets/beasts/tiebei.webp';
const b60 = './game-assets/beasts/true_demon.webp';
const b61 = './game-assets/beasts/tujia.webp';
const b62 = './game-assets/beasts/venomous_snake.webp';
const b63 = './game-assets/beasts/vulture.webp';
const b64 = './game-assets/beasts/wolf.webp';
const b65 = './game-assets/beasts/xuangui.webp';
const b66 = './game-assets/beasts/yinchi.webp';
const b67 = './game-assets/beasts/yinhun.webp';
const b68 = './game-assets/beasts/yinjiao.webp';
const b69 = './game-assets/beasts/yu_soul.webp';
const b70 = './game-assets/beasts/zombie.webp';
const b71 = './game-assets/beasts/bixiao.webp';
const b72 = './game-assets/beasts/chuanshan.webp';
const b73 = './game-assets/beasts/dianyao.webp';
const b74 = './game-assets/beasts/huoying.webp';
const b75 = './game-assets/beasts/leijiaoling.webp';
const b76 = './game-assets/beasts/molin.webp';
const b77 = './game-assets/beasts/shanxiao.webp';
const b78 = './game-assets/beasts/shilingshu.webp';
const b79 = './game-assets/beasts/tiebeixi.webp';
const b80 = './game-assets/beasts/xiaque.webp';

export const BEAST_SRC: Record<string, string> = {
  amb_deer: b0,
  amb_ox: b1,
  baigu_king: b2,
  baigu_ske: b3,
  baize_fish: b4,
  biyan: b5,
  blackbear: b6,
  blood_puppet: b7,
  bloodbat: b8,
  boar: b9,
  centipede: b10,
  chitong: b11,
  coral_golem: b12,
  devil_corpse: b13,
  dujiao: b14,
  feitian_zombie: b15,
  fengxi: b16,
  fushou: b17,
  ghost_face_spider: b18,
  ghost_jellyfish: b19,
  gold_puppet: b20,
  guijiang: b21,
  gumo_xueyan: b22,
  heisha_guard: b23,
  huajing_shark: b24,
  huochan: b25,
  ice_worm: b26,
  icebear: b27,
  iron_crab: b28,
  jiguan: b29,
  jinbeiyao: b30,
  lightning_eel: b31,
  lynx: b32,
  mangshou: b33,
  miasma_toad: b34,
  mo_soul: b35,
  mojiao: b36,
  mtn_ape: b37,
  pet_crane: b38,
  pet_fox1: b39,
  pet_fox2: b40,
  pet_fox3: b41,
  pet_wolf: b42,
  python: b43,
  qingfeng: b44,
  redwolf: b45,
  sand_scorpion: b46,
  seaturtle: b47,
  shuanggong: b48,
  snow_ape: b49,
  snow_wolf: b50,
  spider: b51,
  spirit_fish: b52,
  stone_puppet: b53,
  sum_motou: b54,
  sum_puppet: b55,
  sum_qingjiao: b56,
  sum_tihun: b57,
  swamp_croc: b58,
  tiebei: b59,
  true_demon: b60,
  tujia: b61,
  venomous_snake: b62,
  vulture: b63,
  wolf: b64,
  xuangui: b65,
  yinchi: b66,
  yinhun: b67,
  yinjiao: b68,
  yu_soul: b69,
  zombie: b70,
  bixiao: b71,
  chuanshan: b72,
  dianyao: b73,
  huoying: b74,
  leijiaoling: b75,
  molin: b76,
  shanxiao: b77,
  shilingshu: b78,
  tiebeixi: b79,
  xiaque: b80,
};
