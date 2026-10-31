// 第二十三步：摆件 / 遗迹 / 名地构件画材（data URL 内联，按需解码；tools/propconvert.ts 生成）
const p0 = './game-assets/prop/well.webp';
const p1 = './game-assets/prop/cart.webp';
const p2 = './game-assets/prop/barrow.webp';
const p3 = './game-assets/prop/brazier.webp';
const p4 = './game-assets/prop/censer.webp';
const p5 = './game-assets/prop/lamppost.webp';
const p6 = './game-assets/prop/slantern.webp';
const p7 = './game-assets/prop/signpost.webp';
const p8 = './game-assets/prop/notice.webp';
const p9 = './game-assets/prop/barrels.webp';
const p10 = './game-assets/prop/crates.webp';
const p11 = './game-assets/prop/firewood.webp';
const p12 = './game-assets/prop/haystack.webp';
const p13 = './game-assets/prop/weaponrack.webp';
const p14 = './game-assets/prop/target.webp';
const p15 = './game-assets/prop/oxcart.webp';
const p16 = './game-assets/prop/dummy.webp';
const p17 = './game-assets/prop/teatable.webp';
const p18 = './game-assets/prop/stall_herb.webp';
const p19 = './game-assets/prop/stall_weapon.webp';
const p20 = './game-assets/prop/stall_tal.webp';
const p21 = './game-assets/prop/lion_l.webp';
const p22 = './game-assets/prop/lion_r.webp';
const p23 = './game-assets/prop/cauldron.webp';
const p24 = './game-assets/prop/cauldron_dark.webp';
const p25 = './game-assets/prop/crystal_s.webp';
const p26 = './game-assets/prop/crystal_l.webp';
const p27 = './game-assets/prop/crystal_blood.webp';
const p28 = './game-assets/prop/herbpot.webp';
const p29 = './game-assets/prop/scarecrow.webp';
const p30 = './game-assets/prop/trough.webp';
const p31 = './game-assets/prop/fence_wood.webp';
const p32 = './game-assets/prop/fence_stone.webp';
const p33 = './game-assets/prop/fence_jade.webp';
const p34 = './game-assets/prop/banner_sect.webp';
const p35 = './game-assets/prop/banner_demon.webp';
const p36 = './game-assets/prop/banner_steppe.webp';
const p37 = './game-assets/prop/boat_s.webp';
const p38 = './game-assets/prop/flyboat.webp';
const p39 = './game-assets/prop/chest.webp';
const p40 = './game-assets/prop/stele_a.webp';
const p41 = './game-assets/prop/stele_b.webp';
const p42 = './game-assets/prop/stele_c.webp';
const p43 = './game-assets/prop/nest.webp';
const p44 = './game-assets/prop/pillar_broken.webp';
const p45 = './game-assets/prop/pillar_fallen.webp';
const p46 = './game-assets/prop/ore.webp';
const p47 = './game-assets/prop/arch_ruin.webp';
const p48 = './game-assets/prop/altar.webp';
const p49 = './game-assets/prop/altar_blood.webp';
const p50 = './game-assets/prop/tp_on.webp';
const p51 = './game-assets/prop/tp_off.webp';
const p52 = './game-assets/prop/sealstone.webp';
const p53 = './game-assets/prop/swordstone.webp';
const p54 = './game-assets/prop/skeleton.webp';
const p55 = './game-assets/prop/bones.webp';
const p56 = './game-assets/prop/coffin.webp';
const p57 = './game-assets/prop/cairn.webp';
const p58 = './game-assets/prop/boundary.webp';
const p59 = './game-assets/prop/flagpillar.webp';
const p60 = './game-assets/prop/coral.webp';
const p61 = './game-assets/prop/icepillar.webp';
const p62 = './game-assets/prop/e_platform.webp';
const p63 = './game-assets/prop/e_gatepillar.webp';
const p64 = './game-assets/prop/e_altar_broken.webp';
const p65 = './game-assets/prop/e_tp_ancient.webp';
const p66 = './game-assets/prop/e_tp_broken.webp';
const p67 = './game-assets/prop/e_xt_bridge.webp';
const p68 = './game-assets/prop/e_xt_icefire.webp';
const p69 = './game-assets/prop/e_xt_hall.webp';
const p70 = './game-assets/prop/e_hanli_platform.webp';
const p71 = './game-assets/prop/e_mine.webp';
const p72 = './game-assets/prop/e_tower.webp';
const p73 = './game-assets/prop/e_pillar_a.webp';
const p74 = './game-assets/prop/e_pillar_b.webp';
const p75 = './game-assets/prop/e_pillar_c.webp';
const p76 = './game-assets/prop/e_sealchain.webp';
const p77 = './game-assets/prop/e_swordpav.webp';
const p78 = './game-assets/prop/e_valley_stele.webp';
const p79 = './game-assets/prop/e_kunwu_stele.webp';
const p80 = './game-assets/prop/e_seal_altar.webp';
const p81 = './game-assets/prop/e_lingquan.webp';
const p82 = './game-assets/prop/e_firemouth.webp';
const p83 = './game-assets/prop/e_cave_bed.webp';
const p84 = './game-assets/prop/e_cave_table.webp';
const p85 = './game-assets/prop/e_herb_plot.webp';
const p86 = './game-assets/prop/e_insect_room.webp';
const p87 = './game-assets/prop/e_eye_spring.webp';
const p88 = './game-assets/prop/e_eye_tree.webp';
const p89 = './game-assets/prop/e_unknown_altar.webp';
const p90 = './game-assets/prop/e_vortex.webp';
const p91 = './game-assets/prop/e_biling_mine.webp';
const p92 = './game-assets/prop/e_holyfire.webp';
const p93 = './game-assets/prop/e_heilian.webp';
const p94 = './game-assets/prop/e_ship_s.webp';
const p95 = './game-assets/prop/e_ship_l.webp';
const p96 = './game-assets/prop/e_icegap.webp';
const ps0 = './game-assets/prop/s_tower.webp';
const ps1 = './game-assets/prop/s_bridge.webp';
const ps2 = './game-assets/prop/s_pagoda.webp';
const ps3 = './game-assets/prop/s_buddha.webp';
const ps4 = './game-assets/prop/s_temple.webp';
const ps5 = './game-assets/prop/s_ruins.webp';
const ps6 = './game-assets/prop/s_dock.webp';
const ps7 = './game-assets/prop/s_pavilion.webp';
const ps8 = './game-assets/prop/s_shuixie.webp';
const ps9 = './game-assets/prop/s_zhulu.webp';
const ps10 = './game-assets/prop/s_chapeng.webp';
const ps11 = './game-assets/prop/s_shuiche.webp';
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
