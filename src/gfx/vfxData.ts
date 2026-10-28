// 第二十四步：法术特效关键形态图（外部 AI 绘制，256px；tools/vfxconvert.ts 生成，勿手改；?url 按需加载）
import v0 from '../assets/vfx/array_activate_burst.webp?url';
import v1 from '../assets/vfx/array_activate_ring.webp?url';
import v2 from '../assets/vfx/blood_burst_burst.webp?url';
import v3 from '../assets/vfx/blood_burst_head.webp?url';
import v4 from '../assets/vfx/breakthrough_burst.webp?url';
import v5 from '../assets/vfx/breakthrough_ring.webp?url';
import v6 from '../assets/vfx/earth_spike_burst.webp?url';
import v7 from '../assets/vfx/earth_spike_head.webp?url';
import v8 from '../assets/vfx/fire_bird_burst.webp?url';
import v9 from '../assets/vfx/fire_bird_head.webp?url';
import v10 from '../assets/vfx/fire_bird_trail.webp?url';
import v11 from '../assets/vfx/fireball_burst.webp?url';
import v12 from '../assets/vfx/fireball_head.webp?url';
import v13 from '../assets/vfx/fireball_trail.webp?url';
import v14 from '../assets/vfx/gold_arc_burst.webp?url';
import v15 from '../assets/vfx/gold_arc_head.webp?url';
import v16 from '../assets/vfx/gold_arc_trail.webp?url';
import v17 from '../assets/vfx/heal_green_burst.webp?url';
import v18 from '../assets/vfx/heal_green_ring.webp?url';
import v19 from '../assets/vfx/hit_spark_burst.webp?url';
import v20 from '../assets/vfx/hit_spark_head.webp?url';
import v21 from '../assets/vfx/ice_cone_burst.webp?url';
import v22 from '../assets/vfx/ice_cone_head.webp?url';
import v23 from '../assets/vfx/ice_cone_trail.webp?url';
import v24 from '../assets/vfx/ice_freeze_burst.webp?url';
import v25 from '../assets/vfx/ice_freeze_head.webp?url';
import v26 from '../assets/vfx/poison_arrow_burst.webp?url';
import v27 from '../assets/vfx/poison_arrow_head.webp?url';
import v28 from '../assets/vfx/poison_arrow_trail.webp?url';
import v29 from '../assets/vfx/poison_cloud_burst.webp?url';
import v30 from '../assets/vfx/poison_cloud_ring.webp?url';
import v31 from '../assets/vfx/shield_black_burst.webp?url';
import v32 from '../assets/vfx/shield_black_ring.webp?url';
import v33 from '../assets/vfx/shield_blue_burst.webp?url';
import v34 from '../assets/vfx/shield_blue_ring.webp?url';
import v35 from '../assets/vfx/shield_five_burst.webp?url';
import v36 from '../assets/vfx/shield_five_ring.webp?url';
import v37 from '../assets/vfx/shield_gold_burst.webp?url';
import v38 from '../assets/vfx/shield_gold_ring.webp?url';
import v39 from '../assets/vfx/soul_wisp_burst.webp?url';
import v40 from '../assets/vfx/soul_wisp_head.webp?url';
import v41 from '../assets/vfx/soul_wisp_trail.webp?url';
import v42 from '../assets/vfx/sword_qi_gold_burst.webp?url';
import v43 from '../assets/vfx/sword_qi_gold_head.webp?url';
import v44 from '../assets/vfx/sword_qi_gold_trail.webp?url';
import v45 from '../assets/vfx/sword_qi_green_burst.webp?url';
import v46 from '../assets/vfx/sword_qi_green_head.webp?url';
import v47 from '../assets/vfx/sword_qi_green_trail.webp?url';
import v48 from '../assets/vfx/sword_qi_red_burst.webp?url';
import v49 from '../assets/vfx/sword_qi_red_head.webp?url';
import v50 from '../assets/vfx/sword_qi_red_trail.webp?url';
import v51 from '../assets/vfx/sword_rain_burst.webp?url';
import v52 from '../assets/vfx/sword_rain_head.webp?url';
import v53 from '../assets/vfx/teleport_flash_burst.webp?url';
import v54 from '../assets/vfx/teleport_flash_ring.webp?url';
import v55 from '../assets/vfx/thunder_blue_burst.webp?url';
import v56 from '../assets/vfx/thunder_blue_head.webp?url';
import v57 from '../assets/vfx/thunder_gold_burst.webp?url';
import v58 from '../assets/vfx/thunder_gold_head.webp?url';
import v59 from '../assets/vfx/wind_blade_burst.webp?url';
import v60 from '../assets/vfx/wind_blade_head.webp?url';
import v61 from '../assets/vfx/wind_blade_trail.webp?url';
import v62 from '../assets/vfx/wood_vines_burst.webp?url';
import v63 from '../assets/vfx/wood_vines_ring.webp?url';
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
