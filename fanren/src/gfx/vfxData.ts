// 第二十四步：法术特效关键形态图（外部 AI 绘制，256px；tools/vfxconvert.ts 生成，勿手改）
const v0 = './game-assets/vfx/array_activate_burst.webp';
const v1 = './game-assets/vfx/array_activate_ring.webp';
const v2 = './game-assets/vfx/blood_burst_burst.webp';
const v3 = './game-assets/vfx/blood_burst_head.webp';
const v4 = './game-assets/vfx/breakthrough_burst.webp';
const v5 = './game-assets/vfx/breakthrough_ring.webp';
const v6 = './game-assets/vfx/earth_spike_burst.webp';
const v7 = './game-assets/vfx/earth_spike_head.webp';
const v8 = './game-assets/vfx/fire_bird_burst.webp';
const v9 = './game-assets/vfx/fire_bird_head.webp';
const v10 = './game-assets/vfx/fire_bird_trail.webp';
const v11 = './game-assets/vfx/fireball_burst.webp';
const v12 = './game-assets/vfx/fireball_head.webp';
const v13 = './game-assets/vfx/fireball_trail.webp';
const v14 = './game-assets/vfx/gold_arc_burst.webp';
const v15 = './game-assets/vfx/gold_arc_head.webp';
const v16 = './game-assets/vfx/gold_arc_trail.webp';
const v17 = './game-assets/vfx/heal_green_burst.webp';
const v18 = './game-assets/vfx/heal_green_ring.webp';
const v19 = './game-assets/vfx/hit_spark_burst.webp';
const v20 = './game-assets/vfx/hit_spark_head.webp';
const v21 = './game-assets/vfx/ice_cone_burst.webp';
const v22 = './game-assets/vfx/ice_cone_head.webp';
const v23 = './game-assets/vfx/ice_cone_trail.webp';
const v24 = './game-assets/vfx/ice_freeze_burst.webp';
const v25 = './game-assets/vfx/ice_freeze_head.webp';
const v26 = './game-assets/vfx/poison_arrow_burst.webp';
const v27 = './game-assets/vfx/poison_arrow_head.webp';
const v28 = './game-assets/vfx/poison_arrow_trail.webp';
const v29 = './game-assets/vfx/poison_cloud_burst.webp';
const v30 = './game-assets/vfx/poison_cloud_ring.webp';
const v31 = './game-assets/vfx/shield_black_burst.webp';
const v32 = './game-assets/vfx/shield_black_ring.webp';
const v33 = './game-assets/vfx/shield_blue_burst.webp';
const v34 = './game-assets/vfx/shield_blue_ring.webp';
const v35 = './game-assets/vfx/shield_five_burst.webp';
const v36 = './game-assets/vfx/shield_five_ring.webp';
const v37 = './game-assets/vfx/shield_gold_burst.webp';
const v38 = './game-assets/vfx/shield_gold_ring.webp';
const v39 = './game-assets/vfx/soul_wisp_burst.webp';
const v40 = './game-assets/vfx/soul_wisp_head.webp';
const v41 = './game-assets/vfx/soul_wisp_trail.webp';
const v42 = './game-assets/vfx/sword_qi_gold_burst.webp';
const v43 = './game-assets/vfx/sword_qi_gold_head.webp';
const v44 = './game-assets/vfx/sword_qi_gold_trail.webp';
const v45 = './game-assets/vfx/sword_qi_green_burst.webp';
const v46 = './game-assets/vfx/sword_qi_green_head.webp';
const v47 = './game-assets/vfx/sword_qi_green_trail.webp';
const v48 = './game-assets/vfx/sword_qi_red_burst.webp';
const v49 = './game-assets/vfx/sword_qi_red_head.webp';
const v50 = './game-assets/vfx/sword_qi_red_trail.webp';
const v51 = './game-assets/vfx/sword_rain_burst.webp';
const v52 = './game-assets/vfx/sword_rain_head.webp';
const v53 = './game-assets/vfx/teleport_flash_burst.webp';
const v54 = './game-assets/vfx/teleport_flash_ring.webp';
const v55 = './game-assets/vfx/thunder_blue_burst.webp';
const v56 = './game-assets/vfx/thunder_blue_head.webp';
const v57 = './game-assets/vfx/thunder_gold_burst.webp';
const v58 = './game-assets/vfx/thunder_gold_head.webp';
const v59 = './game-assets/vfx/wind_blade_burst.webp';
const v60 = './game-assets/vfx/wind_blade_head.webp';
const v61 = './game-assets/vfx/wind_blade_trail.webp';
const v62 = './game-assets/vfx/wood_vines_burst.webp';
const v63 = './game-assets/vfx/wood_vines_ring.webp';
export const VFX_SRC: Record<string, string> = {
  array_activate_burst: v0,
  array_activate_ring: v1,
  blood_burst_burst: v2,
  blood_burst_head: v3,
  breakthrough_burst: v4,
  breakthrough_ring: v5,
  earth_spike_burst: v6,
  earth_spike_head: v7,
  fire_bird_burst: v8,
  fire_bird_head: v9,
  fire_bird_trail: v10,
  fireball_burst: v11,
  fireball_head: v12,
  fireball_trail: v13,
  gold_arc_burst: v14,
  gold_arc_head: v15,
  gold_arc_trail: v16,
  heal_green_burst: v17,
  heal_green_ring: v18,
  hit_spark_burst: v19,
  hit_spark_head: v20,
  ice_cone_burst: v21,
  ice_cone_head: v22,
  ice_cone_trail: v23,
  ice_freeze_burst: v24,
  ice_freeze_head: v25,
  poison_arrow_burst: v26,
  poison_arrow_head: v27,
  poison_arrow_trail: v28,
  poison_cloud_burst: v29,
  poison_cloud_ring: v30,
  shield_black_burst: v31,
  shield_black_ring: v32,
  shield_blue_burst: v33,
  shield_blue_ring: v34,
  shield_five_burst: v35,
  shield_five_ring: v36,
  shield_gold_burst: v37,
  shield_gold_ring: v38,
  soul_wisp_burst: v39,
  soul_wisp_head: v40,
  soul_wisp_trail: v41,
  sword_qi_gold_burst: v42,
  sword_qi_gold_head: v43,
  sword_qi_gold_trail: v44,
  sword_qi_green_burst: v45,
  sword_qi_green_head: v46,
  sword_qi_green_trail: v47,
  sword_qi_red_burst: v48,
  sword_qi_red_head: v49,
  sword_qi_red_trail: v50,
  sword_rain_burst: v51,
  sword_rain_head: v52,
  teleport_flash_burst: v53,
  teleport_flash_ring: v54,
  thunder_blue_burst: v55,
  thunder_blue_head: v56,
  thunder_gold_burst: v57,
  thunder_gold_head: v58,
  wind_blade_burst: v59,
  wind_blade_head: v60,
  wind_blade_trail: v61,
  wood_vines_burst: v62,
  wood_vines_ring: v63,
};
