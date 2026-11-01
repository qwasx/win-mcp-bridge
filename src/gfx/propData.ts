// 第二十三步：摆件 / 遗迹 / 名地构件画材（data URL 内联，按需解码；tools/propconvert.ts 生成）
import p0 from '../assets/prop/well.webp?inline';
import p1 from '../assets/prop/cart.webp?inline';
import p2 from '../assets/prop/barrow.webp?inline';
import p3 from '../assets/prop/brazier.webp?inline';
import p4 from '../assets/prop/censer.webp?inline';
import p5 from '../assets/prop/lamppost.webp?inline';
import p6 from '../assets/prop/slantern.webp?inline';
import p7 from '../assets/prop/signpost.webp?inline';
import p8 from '../assets/prop/notice.webp?inline';
import p9 from '../assets/prop/barrels.webp?inline';
import p10 from '../assets/prop/crates.webp?inline';
import p11 from '../assets/prop/firewood.webp?inline';
import p12 from '../assets/prop/haystack.webp?inline';
import p13 from '../assets/prop/weaponrack.webp?inline';
import p14 from '../assets/prop/target.webp?inline';
import p15 from '../assets/prop/oxcart.webp?inline';
import p16 from '../assets/prop/dummy.webp?inline';
import p17 from '../assets/prop/teatable.webp?inline';
import p18 from '../assets/prop/stall_herb.webp?inline';
import p19 from '../assets/prop/stall_weapon.webp?inline';
import p20 from '../assets/prop/stall_tal.webp?inline';
import p21 from '../assets/prop/lion_l.webp?inline';
import p22 from '../assets/prop/lion_r.webp?inline';
import p23 from '../assets/prop/cauldron.webp?inline';
import p24 from '../assets/prop/cauldron_dark.webp?inline';
import p25 from '../assets/prop/crystal_s.webp?inline';
import p26 from '../assets/prop/crystal_l.webp?inline';
import p27 from '../assets/prop/crystal_blood.webp?inline';
import p28 from '../assets/prop/herbpot.webp?inline';
import p29 from '../assets/prop/scarecrow.webp?inline';
import p30 from '../assets/prop/trough.webp?inline';
import p31 from '../assets/prop/fence_wood.webp?inline';
import p32 from '../assets/prop/fence_stone.webp?inline';
import p33 from '../assets/prop/fence_jade.webp?inline';
import p34 from '../assets/prop/banner_sect.webp?inline';
import p35 from '../assets/prop/banner_demon.webp?inline';
import p36 from '../assets/prop/banner_steppe.webp?inline';
import p37 from '../assets/prop/boat_s.webp?inline';
import p38 from '../assets/prop/flyboat.webp?inline';
import p39 from '../assets/prop/chest.webp?inline';
import p40 from '../assets/prop/stele_a.webp?inline';
import p41 from '../assets/prop/stele_b.webp?inline';
import p42 from '../assets/prop/stele_c.webp?inline';
import p43 from '../assets/prop/nest.webp?inline';
import p44 from '../assets/prop/pillar_broken.webp?inline';
import p45 from '../assets/prop/pillar_fallen.webp?inline';
import p46 from '../assets/prop/ore.webp?inline';
import p47 from '../assets/prop/arch_ruin.webp?inline';
import p48 from '../assets/prop/altar.webp?inline';
import p49 from '../assets/prop/altar_blood.webp?inline';
import p50 from '../assets/prop/tp_on.webp?inline';
import p51 from '../assets/prop/tp_off.webp?inline';
import p52 from '../assets/prop/sealstone.webp?inline';
import p53 from '../assets/prop/swordstone.webp?inline';
import p54 from '../assets/prop/skeleton.webp?inline';
import p55 from '../assets/prop/bones.webp?inline';
import p56 from '../assets/prop/coffin.webp?inline';
import p57 from '../assets/prop/cairn.webp?inline';
import p58 from '../assets/prop/boundary.webp?inline';
import p59 from '../assets/prop/flagpillar.webp?inline';
import p60 from '../assets/prop/coral.webp?inline';
import p61 from '../assets/prop/icepillar.webp?inline';
import p62 from '../assets/prop/e_platform.webp?inline';
import p63 from '../assets/prop/e_gatepillar.webp?inline';
import p64 from '../assets/prop/e_altar_broken.webp?inline';
import p65 from '../assets/prop/e_tp_ancient.webp?inline';
import p66 from '../assets/prop/e_tp_broken.webp?inline';
import p67 from '../assets/prop/e_xt_bridge.webp?inline';
import p68 from '../assets/prop/e_xt_icefire.webp?inline';
import p69 from '../assets/prop/e_xt_hall.webp?inline';
import p70 from '../assets/prop/e_hanli_platform.webp?inline';
import p71 from '../assets/prop/e_mine.webp?inline';
import p72 from '../assets/prop/e_tower.webp?inline';
import p73 from '../assets/prop/e_pillar_a.webp?inline';
import p74 from '../assets/prop/e_pillar_b.webp?inline';
import p75 from '../assets/prop/e_pillar_c.webp?inline';
import p76 from '../assets/prop/e_sealchain.webp?inline';
import p77 from '../assets/prop/e_swordpav.webp?inline';
import p78 from '../assets/prop/e_valley_stele.webp?inline';
import p79 from '../assets/prop/e_kunwu_stele.webp?inline';
import p80 from '../assets/prop/e_seal_altar.webp?inline';
import p81 from '../assets/prop/e_lingquan.webp?inline';
import p82 from '../assets/prop/e_firemouth.webp?inline';
import p83 from '../assets/prop/e_cave_bed.webp?inline';
import p84 from '../assets/prop/e_cave_table.webp?inline';
import p85 from '../assets/prop/e_herb_plot.webp?inline';
import p86 from '../assets/prop/e_insect_room.webp?inline';
import p87 from '../assets/prop/e_eye_spring.webp?inline';
import p88 from '../assets/prop/e_eye_tree.webp?inline';
import p89 from '../assets/prop/e_unknown_altar.webp?inline';
import p90 from '../assets/prop/e_vortex.webp?inline';
import p91 from '../assets/prop/e_biling_mine.webp?inline';
import p92 from '../assets/prop/e_holyfire.webp?inline';
import p93 from '../assets/prop/e_heilian.webp?inline';
import p94 from '../assets/prop/e_ship_s.webp?inline';
import p95 from '../assets/prop/e_ship_l.webp?inline';
import p96 from '../assets/prop/e_icegap.webp?inline';
import ps0 from '../assets/prop/s_tower.webp?inline';
import ps1 from '../assets/prop/s_bridge.webp?inline';
import ps2 from '../assets/prop/s_pagoda.webp?inline';
import ps3 from '../assets/prop/s_buddha.webp?inline';
import ps4 from '../assets/prop/s_temple.webp?inline';
import ps5 from '../assets/prop/s_ruins.webp?inline';
import ps6 from '../assets/prop/s_dock.webp?inline';
import ps7 from '../assets/prop/s_pavilion.webp?inline';
import ps8 from '../assets/prop/s_shuixie.webp?inline';
import ps9 from '../assets/prop/s_zhulu.webp?inline';
import ps10 from '../assets/prop/s_chapeng.webp?inline';
import ps11 from '../assets/prop/s_shuiche.webp?inline';
export const PROP_SRC: Record<string, string> = {
  p_well: p0,
  p_cart: p1,
  p_barrow: p2,
  p_brazier: p3,
  p_censer: p4,
  p_lamppost: p5,
  p_slantern: p6,
  p_signpost: p7,
  p_notice: p8,
  p_barrels: p9,
  p_crates: p10,
  p_firewood: p11,
  p_haystack: p12,
  p_weaponrack: p13,
  p_target: p14,
  p_oxcart: p15,
  p_dummy: p16,
  p_teatable: p17,
  p_stall_herb: p18,
  p_stall_weapon: p19,
  p_stall_tal: p20,
  p_lion_l: p21,
  p_lion_r: p22,
  p_cauldron: p23,
  p_cauldron_dark: p24,
  p_crystal_s: p25,
  p_crystal_l: p26,
  p_crystal_blood: p27,
  p_herbpot: p28,
  p_scarecrow: p29,
  p_trough: p30,
  p_fence_wood: p31,
  p_fence_stone: p32,
  p_fence_jade: p33,
  p_banner_sect: p34,
  p_banner_demon: p35,
  p_banner_steppe: p36,
  p_boat_s: p37,
  p_flyboat: p38,
  p_chest: p39,
  p_stele_a: p40,
  p_stele_b: p41,
  p_stele_c: p42,
  p_nest: p43,
  p_pillar_broken: p44,
  p_pillar_fallen: p45,
  p_ore: p46,
  p_arch_ruin: p47,
  p_altar: p48,
  p_altar_blood: p49,
  p_tp_on: p50,
  p_tp_off: p51,
  p_sealstone: p52,
  p_swordstone: p53,
  p_skeleton: p54,
  p_bones: p55,
  p_coffin: p56,
  p_cairn: p57,
  p_boundary: p58,
  p_flagpillar: p59,
  p_coral: p60,
  p_icepillar: p61,
  p_e_platform: p62,
  p_e_gatepillar: p63,
  p_e_altar_broken: p64,
  p_e_tp_ancient: p65,
  p_e_tp_broken: p66,
  p_e_xt_bridge: p67,
  p_e_xt_icefire: p68,
  p_e_xt_hall: p69,
  p_e_hanli_platform: p70,
  p_e_mine: p71,
  p_e_tower: p72,
  p_e_pillar_a: p73,
  p_e_pillar_b: p74,
  p_e_pillar_c: p75,
  p_e_sealchain: p76,
  p_e_swordpav: p77,
  p_e_valley_stele: p78,
  p_e_kunwu_stele: p79,
  p_e_seal_altar: p80,
  p_e_lingquan: p81,
  p_e_firemouth: p82,
  p_e_cave_bed: p83,
  p_e_cave_table: p84,
  p_e_herb_plot: p85,
  p_e_insect_room: p86,
  p_e_eye_spring: p87,
  p_e_eye_tree: p88,
  p_e_unknown_altar: p89,
  p_e_vortex: p90,
  p_e_biling_mine: p91,
  p_e_holyfire: p92,
  p_e_heilian: p93,
  p_e_ship_s: p94,
  p_e_ship_l: p95,
  p_e_icegap: p96,
  p_s_tower: ps0,
  p_s_bridge: ps1,
  p_s_pagoda: ps2,
  p_s_buddha: ps3,
  p_s_temple: ps4,
  p_s_ruins: ps5,
  p_s_dock: ps6,
  p_s_pavilion: ps7,
  p_s_shuixie: ps8,
  p_s_zhulu: ps9,
  p_s_chapeng: ps10,
  p_s_shuiche: ps11,
};
