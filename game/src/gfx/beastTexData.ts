// 第二十一步：妖兽 / 灵宠 / 召唤物贴图（外部 AI 绘制，已裁边、补实透明度），data URL 内联
import b0 from '../assets/beasts/amb_deer.webp?inline';
import b1 from '../assets/beasts/amb_ox.webp?inline';
import b2 from '../assets/beasts/baigu_king.webp?inline';
import b3 from '../assets/beasts/baigu_ske.webp?inline';
import b4 from '../assets/beasts/baize_fish.webp?inline';
import b5 from '../assets/beasts/biyan.webp?inline';
import b6 from '../assets/beasts/blackbear.webp?inline';
import b7 from '../assets/beasts/blood_puppet.webp?inline';
import b8 from '../assets/beasts/bloodbat.webp?inline';
import b9 from '../assets/beasts/boar.webp?inline';
import b10 from '../assets/beasts/centipede.webp?inline';
import b11 from '../assets/beasts/chitong.webp?inline';
import b12 from '../assets/beasts/coral_golem.webp?inline';
import b13 from '../assets/beasts/devil_corpse.webp?inline';
import b14 from '../assets/beasts/dujiao.webp?inline';
import b15 from '../assets/beasts/feitian_zombie.webp?inline';
import b16 from '../assets/beasts/fengxi.webp?inline';
import b17 from '../assets/beasts/fushou.webp?inline';
import b18 from '../assets/beasts/ghost_face_spider.webp?inline';
import b19 from '../assets/beasts/ghost_jellyfish.webp?inline';
import b20 from '../assets/beasts/gold_puppet.webp?inline';
import b21 from '../assets/beasts/guijiang.webp?inline';
import b22 from '../assets/beasts/gumo_xueyan.webp?inline';
import b23 from '../assets/beasts/heisha_guard.webp?inline';
import b24 from '../assets/beasts/huajing_shark.webp?inline';
import b25 from '../assets/beasts/huochan.webp?inline';
import b26 from '../assets/beasts/ice_worm.webp?inline';
import b27 from '../assets/beasts/icebear.webp?inline';
import b28 from '../assets/beasts/iron_crab.webp?inline';
import b29 from '../assets/beasts/jiguan.webp?inline';
import b30 from '../assets/beasts/jinbeiyao.webp?inline';
import b31 from '../assets/beasts/lightning_eel.webp?inline';
import b32 from '../assets/beasts/lynx.webp?inline';
import b33 from '../assets/beasts/mangshou.webp?inline';
import b34 from '../assets/beasts/miasma_toad.webp?inline';
import b35 from '../assets/beasts/mo_soul.webp?inline';
import b36 from '../assets/beasts/mojiao.webp?inline';
import b37 from '../assets/beasts/mtn_ape.webp?inline';
import b38 from '../assets/beasts/pet_crane.webp?inline';
import b39 from '../assets/beasts/pet_fox1.webp?inline';
import b40 from '../assets/beasts/pet_fox2.webp?inline';
import b41 from '../assets/beasts/pet_fox3.webp?inline';
import b42 from '../assets/beasts/pet_wolf.webp?inline';
import b43 from '../assets/beasts/python.webp?inline';
import b44 from '../assets/beasts/qingfeng.webp?inline';
import b45 from '../assets/beasts/redwolf.webp?inline';
import b46 from '../assets/beasts/sand_scorpion.webp?inline';
import b47 from '../assets/beasts/seaturtle.webp?inline';
import b48 from '../assets/beasts/shuanggong.webp?inline';
import b49 from '../assets/beasts/snow_ape.webp?inline';
import b50 from '../assets/beasts/snow_wolf.webp?inline';
import b51 from '../assets/beasts/spider.webp?inline';
import b52 from '../assets/beasts/spirit_fish.webp?inline';
import b53 from '../assets/beasts/stone_puppet.webp?inline';
import b54 from '../assets/beasts/sum_motou.webp?inline';
import b55 from '../assets/beasts/sum_puppet.webp?inline';
import b56 from '../assets/beasts/sum_qingjiao.webp?inline';
import b57 from '../assets/beasts/sum_tihun.webp?inline';
import b58 from '../assets/beasts/swamp_croc.webp?inline';
import b59 from '../assets/beasts/tiebei.webp?inline';
import b60 from '../assets/beasts/true_demon.webp?inline';
import b61 from '../assets/beasts/tujia.webp?inline';
import b62 from '../assets/beasts/venomous_snake.webp?inline';
import b63 from '../assets/beasts/vulture.webp?inline';
import b64 from '../assets/beasts/wolf.webp?inline';
import b65 from '../assets/beasts/xuangui.webp?inline';
import b66 from '../assets/beasts/yinchi.webp?inline';
import b67 from '../assets/beasts/yinhun.webp?inline';
import b68 from '../assets/beasts/yinjiao.webp?inline';
import b69 from '../assets/beasts/yu_soul.webp?inline';
import b70 from '../assets/beasts/zombie.webp?inline';
import b71 from '../assets/beasts/bixiao.webp?inline';
import b72 from '../assets/beasts/chuanshan.webp?inline';
import b73 from '../assets/beasts/dianyao.webp?inline';
import b74 from '../assets/beasts/huoying.webp?inline';
import b75 from '../assets/beasts/leijiaoling.webp?inline';
import b76 from '../assets/beasts/molin.webp?inline';
import b77 from '../assets/beasts/shanxiao.webp?inline';
import b78 from '../assets/beasts/shilingshu.webp?inline';
import b79 from '../assets/beasts/tiebeixi.webp?inline';
import b80 from '../assets/beasts/xiaque.webp?inline';

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
