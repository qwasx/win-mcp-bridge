// 第二十三步：摆件 / 遗迹 / 名地构件 / 物品图标 画材转换
// 用法：npx tsx tools/propconvert.ts /tmp/af/fanren/art-incoming/full
// 产出：src/assets/prop/*.webp + src/gfx/propDims.ts + src/gfx/propData.ts；src/assets/icons/*.webp + src/gfx/iconData.ts
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const ROOT = process.argv[2] || '/tmp/af/fanren/art-incoming/full';

// 世界尺寸：w = 世界宽，或 h = 世界高（主角约 108 高、40 宽）
type Spec = { f: string; w?: number; h?: number };
const P: Record<string, Spec> = {
  // —— 城镇摆件
  well: { f: 'props/P01_well.png', w: 150 }, cart: { f: 'props/P02_cart.png', w: 200 }, barrow: { f: 'props/P03_wheelbarrow.png', w: 120 },
  brazier: { f: 'props/P04_brazier.png', h: 110 }, censer: { f: 'props/P05_censer.png', w: 110 }, lamppost: { f: 'props/P06_lantern_post.png', h: 190 },
  slantern: { f: 'props/P07_stone_lantern.png', h: 120 }, signpost: { f: 'props/P08_signpost.png', h: 150 }, notice: { f: 'props/P09_notice_board.png', w: 170 },
  barrels: { f: 'props/P10_barrel_cluster.png', w: 140 }, crates: { f: 'props/P11_crate_stack.png', w: 120 }, firewood: { f: 'props/P12_firewood.png', w: 120 },
  haystack: { f: 'props/P13_haystack.png', w: 130 }, weaponrack: { f: 'props/P14_weapon_rack.png', w: 140 }, target: { f: 'props/P15_archery_target.png', h: 130 },
  oxcart: { f: 'props/P15_cart.png', w: 220 }, dummy: { f: 'props/P16_training_dummy.png', h: 125 }, teatable: { f: 'props/P17_tea_table.png', w: 140 },
  stall_herb: { f: 'props/P18_stall_herbs.png', w: 210 }, stall_weapon: { f: 'props/P19_stall_weapons.png', w: 210 }, stall_tal: { f: 'props/P20_stall_talismans.png', w: 210 },
  lion_l: { f: 'props/P21_stone_lion_l.png', h: 135 }, lion_r: { f: 'props/P22_stone_lion_r.png', h: 135 },
  cauldron: { f: 'props/P23_cauldron_alchemy.png', w: 130 }, cauldron_dark: { f: 'props/P24_cauldron_dark.png', w: 130 },
  crystal_s: { f: 'props/P25_spirit_crystal_sm.png', w: 70 }, crystal_l: { f: 'props/P26_spirit_crystal_lg.png', w: 130 }, crystal_blood: { f: 'props/P27_blood_crystal.png', w: 110 },
  herbpot: { f: 'props/P28_herb_pot.png', w: 70 }, scarecrow: { f: 'props/P29_scarecrow.png', h: 140 }, trough: { f: 'props/P30_water_trough.png', w: 130 },
  fence_wood: { f: 'props/P31_fence_wood_h.png', w: 260 }, fence_stone: { f: 'props/P33_fence_stone_h.png', w: 260 }, fence_jade: { f: 'props/P34_fence_jade_h.png', w: 260 },
  banner_sect: { f: 'props/P35_sect_banner.png', h: 250 }, banner_demon: { f: 'props/P36_demon_banner.png', h: 250 }, banner_steppe: { f: 'props/P37_steppe_banner.png', h: 250 },
  boat_s: { f: 'props/P38_boat_small.png', w: 250 }, flyboat: { f: 'props/P39_flying_boat.png', w: 420 }, chest: { f: 'props/P40_treasure_chest.png', w: 90 },
  // —— 野外遗迹（机缘）
  stele_a: { f: 'props/S01_stele_a.png', h: 170 }, stele_b: { f: 'props/S01_stele_b.png', h: 170 }, stele_c: { f: 'props/S01_stele_c.png', h: 170 },
  nest: { f: 'props/S02_beast_nest.png', w: 210 }, pillar_broken: { f: 'props/S02_broken_pillar.png', h: 180 }, pillar_fallen: { f: 'props/S03_fallen_pillar.png', w: 240 },
  ore: { f: 'props/S03_spirit_ore.png', w: 200 }, arch_ruin: { f: 'props/S04_ruined_arch.png', w: 320 }, altar: { f: 'props/S05_stone_altar.png', w: 210 },
  altar_blood: { f: 'props/S06_blood_altar_sm.png', w: 200 }, tp_on: { f: 'props/S07_teleport_pad_active.png', w: 300 }, tp_off: { f: 'props/S08_teleport_pad_broken.png', w: 300 },
  sealstone: { f: 'props/S09_seal_stone.png', w: 160 }, swordstone: { f: 'props/S10_giant_sword_stone.png', h: 300 }, skeleton: { f: 'props/S11_skeleton_sitting.png', w: 95 },
  bones: { f: 'props/S12_bone_pile.png', w: 140 }, coffin: { f: 'props/S13_sarcophagus.png', w: 210 }, cairn: { f: 'props/S14_cairn.png', w: 110 },
  boundary: { f: 'props/S15_boundary_stone.png', h: 130 }, flagpillar: { f: 'props/S16_array_flag_pillar.png', h: 220 }, coral: { f: 'props/S17_coral_pillar.png', h: 200 },
  icepillar: { f: 'props/S18_ice_pillar.png', h: 220 },
  // —— 原著名地构件
  e_platform: { f: 'landmarks/E01_platform.png', w: 700 }, e_gatepillar: { f: 'landmarks/E02_gate_pillar.png', w: 520 }, e_altar_broken: { f: 'landmarks/E03_altar_broken.png', w: 420 },
  e_tp_ancient: { f: 'landmarks/E04_teleport_ancient.png', w: 520 }, e_tp_broken: { f: 'landmarks/E04_teleport_broken.png', w: 520 }, e_xt_bridge: { f: 'landmarks/E05_xutian_bridge.png', w: 640 },
  e_xt_icefire: { f: 'landmarks/E06_xutian_Icefire_road.png', w: 640 }, e_xt_hall: { f: 'landmarks/E07_xutian_inner_hall.png', w: 720 }, e_hanli_platform: { f: 'landmarks/E08_hanli_platform.png', w: 520 },
  e_mine: { f: 'landmarks/E09_mine_entrance.png', w: 380 }, e_tower: { f: 'landmarks/E10_magic_tower.png', h: 620 }, e_pillar_a: { f: 'landmarks/E11a_pillar_intact.png', h: 380 },
  e_pillar_b: { f: 'landmarks/E11b_pillar_half.png', h: 260 }, e_pillar_c: { f: 'landmarks/E11c_pillar_fallen.png', w: 380 }, e_sealchain: { f: 'landmarks/E12a_seal_chain.png', h: 380 },
  e_swordpav: { f: 'landmarks/E12b_sword_pavilion.png', w: 420 }, e_valley_stele: { f: 'landmarks/E13_valley_stele.png', h: 300 }, e_kunwu_stele: { f: 'landmarks/E14_kunwu_stele.png', h: 340 },
  e_seal_altar: { f: 'landmarks/E15_devil_seal_altar.png', w: 560 }, e_lingquan: { f: 'landmarks/E16_lingqu_pool.png', w: 420 }, e_firemouth: { f: 'landmarks/E17_earth_fire_mouth.png', w: 340 },
  e_cave_bed: { f: 'landmarks/E18a_cave_bed.png', w: 220 }, e_cave_table: { f: 'landmarks/E18b_cave_table.png', w: 180 }, e_herb_plot: { f: 'landmarks/E18c_herb_plot.png', w: 300 },
  e_insect_room: { f: 'landmarks/E18d_insect_room.png', w: 280 }, e_eye_spring: { f: 'landmarks/E19_spirit_eye_spring.png', w: 300 }, e_eye_tree: { f: 'landmarks/E20_spirit_eye_tree.png', h: 700 },
  e_unknown_altar: { f: 'landmarks/E21_unknown_altar.png', w: 460 }, e_vortex: { f: 'landmarks/E22_sea_vortex_marker.png', w: 480 }, e_biling_mine: { f: 'landmarks/E23_biling_mine.png', w: 420 },
  e_holyfire: { f: 'landmarks/E24_mulan_holy_fire.png', w: 360 }, e_heilian: { f: 'landmarks/E25_heilian_altar.png', w: 440 }, e_ship_s: { f: 'landmarks/E26a_ship_small.png', w: 300 },
  e_ship_l: { f: 'landmarks/E26b_ship_large.png', w: 720 }, e_icegap: { f: 'landmarks/E27_ice_wall_gap.png', w: 600 },
};

function alphaBox(d: Uint8ClampedArray, W: number, H: number) {
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 14) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

async function main() {
  const outP = 'src/assets/prop', outI = 'src/assets/icons';
  mkdirSync(outP, { recursive: true }); mkdirSync(outI, { recursive: true });
  const dims: string[] = [], imps: string[] = [], src: string[] = [];
  let i = 0;
  for (const [k, s] of Object.entries(P)) {
    const fp = join(ROOT, s.f); if (!existsSync(fp)) { console.log('缺', s.f); continue; }
    const im = await loadImage(readFileSync(fp));
    const W = im.width, H = im.height, c0 = createCanvas(W, H), g0 = c0.getContext('2d'); g0.drawImage(im, 0, 0);
    const d = g0.getImageData(0, 0, W, H).data as unknown as Uint8ClampedArray;
    const b = alphaBox(d, W, H); if (!b) { console.log('空', s.f); continue; }
    const bw = b.x1 - b.x0 + 1, bh = b.y1 - b.y0 + 1;
    const ww = s.w ?? (s.h! * bw / bh), wh = ww * bh / bw;
    // 存储分辨率：世界尺寸 × 1.6（近看也清楚），不超过原图
    const k2 = Math.min(1, (ww * 1.6) / bw);
    const ow = Math.max(8, Math.round(bw * k2)), oh = Math.max(8, Math.round(bh * k2));
    const c = createCanvas(ow, oh), g = c.getContext('2d');
    g.imageSmoothingEnabled = true; (g as any).imageSmoothingQuality = 'high';
    g.drawImage(c0, b.x0, b.y0, bw, bh, 0, 0, ow, oh);
    writeFileSync(join(outP, k + '.webp'), await c.encode('webp', 84));
    dims.push(`  p_${k}: { w: ${Math.round(ww)}, h: ${Math.round(wh)} },`);
    imps.push(`import p${i} from '../assets/prop/${k}.webp?inline';`); src.push(`  p_${k}: p${i},`); i++;
  }
  writeFileSync('src/gfx/propDims.ts', `// 第二十三步：摆件 / 遗迹 / 名地构件画材尺寸（tools/propconvert.ts 生成，勿手改）\nimport type { BldDim } from './bld2Dims';\nexport const PROP2: Record<string, BldDim> = {\n${dims.join('\n')}\n};\n`);
  writeFileSync('src/gfx/propData.ts', `// 第二十三步：摆件 / 遗迹 / 名地构件画材（data URL 内联，按需解码；tools/propconvert.ts 生成）\n${imps.join('\n')}\nexport const PROP_SRC: Record<string, string> = {\n${src.join('\n')}\n};\n`);
  // —— 物品图标：96px
  const icons = readdirSync(join(ROOT, 'icon')).filter((f) => f.endsWith('.png')).sort();
  const ii: string[] = [], is: string[] = [];
  let j = 0;
  for (const f of icons) {
    const im = await loadImage(readFileSync(join(ROOT, 'icon', f)));
    const W = im.width, H = im.height, c0 = createCanvas(W, H), g0 = c0.getContext('2d'); g0.drawImage(im, 0, 0);
    const d = g0.getImageData(0, 0, W, H).data as unknown as Uint8ClampedArray;
    const b = alphaBox(d, W, H) ?? { x0: 0, y0: 0, x1: W - 1, y1: H - 1 };
    const bw = b.x1 - b.x0 + 1, bh = b.y1 - b.y0 + 1, S = 96, sc = (S - 6) / Math.max(bw, bh);
    const c = createCanvas(S, S), g = c.getContext('2d');
    g.imageSmoothingEnabled = true; (g as any).imageSmoothingQuality = 'high';
    g.drawImage(c0, b.x0, b.y0, bw, bh, (S - bw * sc) / 2, (S - bh * sc) / 2, bw * sc, bh * sc);
    const k = f.replace('.png', '');
    writeFileSync(join(outI, k + '.webp'), await c.encode('webp', 86));
    ii.push(`import i${j} from '../assets/icons/${k}.webp?inline';`); is.push(`  ${k}: i${j},`); j++;
  }
  writeFileSync('src/gfx/iconData.ts', `// 第二十三步：物品图标（外部 AI 绘制，96px，data URL 内联；tools/propconvert.ts 生成）\n${ii.join('\n')}\nexport const ICON_SRC: Record<string, string> = {\n${is.join('\n')}\n};\n`);
  console.log('props', i, 'icons', j);
}
main();
