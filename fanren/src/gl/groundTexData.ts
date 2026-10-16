// 第二十步：地表画材（外部 AI 绘制的水墨淡彩四方连续图块，768²）。
// 以 data URL 内联：双击 index.html（file://）运行时 WebGL 仍可上传。
import g0 from '../assets/ground/g01_grass_a.webp?inline';
import g1 from '../assets/ground/g01_grass_b.webp?inline';
import g2 from '../assets/ground/g01s_grass_autumn.webp?inline';
import g3 from '../assets/ground/g01w_grass_winter.webp?inline';
import g4 from '../assets/ground/g02_forest_a.webp?inline';
import g5 from '../assets/ground/g12_steppe_a.webp?inline';
import g6 from '../assets/ground/g09_desert_a.webp?inline';
import g7 from '../assets/ground/g06b_gravel.webp?inline';
import g8 from '../assets/ground/g20_snow_b.webp?inline';
import g9 from '../assets/ground/g14_road_a.webp?inline';
import g10 from '../assets/ground/g07_riverbank_b.webp?inline';
import g11 from '../assets/ground/g10_gobi_a.webp?inline';

/** 层序与着色器里的层号一一对应（见 ground.ts 的 M_* 常量） */
export const GROUND_SRC: string[] = [g0, g1, g2, g3, g4, g5, g6, g7, g8, g9, g10, g11];
