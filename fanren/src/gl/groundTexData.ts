// 第二十步：地表画材（水墨淡彩四方连续图块，768²）。以 data URL 内联：双击 index.html（file://）运行时 WebGL 仍可上传。
// 第三十步：林地 / 荒漠 / 山石 / 雪原 / 官道 / 河滩 / 戈壁换成新绘的水墨图块，另加魔道赤土、阴地、海滩三层（草甸、草原保持原样）。
import g0 from '../assets/ground/g01_grass_a.webp?inline';
import g1 from '../assets/ground/g01_grass_b.webp?inline';
import g2 from '../assets/ground/g01s_grass_autumn.webp?inline';
import g3 from '../assets/ground/g01w_grass_winter.webp?inline';
import g4 from '../assets/ground/g02_forest_b.webp?inline';
import g5 from '../assets/ground/g12_steppe_a.webp?inline';
import g6 from '../assets/ground/g09_desert_ink.webp?inline';
import g7 from '../assets/ground/g06c_rock_ink.webp?inline';
import g8 from '../assets/ground/g20_snow_ink.webp?inline';
import g9 from '../assets/ground/g14_road_ink.webp?inline';
import g10 from '../assets/ground/g07_riverbank_ink.webp?inline';
import g11 from '../assets/ground/g10_gobi_ink.webp?inline';
import g12 from '../assets/ground/g30_demon_red.webp?inline';
import g13 from '../assets/ground/g31_ghost_ash.webp?inline';
import g14 from '../assets/ground/g32_beach_coral.webp?inline';

/** 层序与着色器里的层号一一对应（与 groundTex.ts 的 GROUND_AVG 同序） */
export const GROUND_SRC: string[] = [g0, g1, g2, g3, g4, g5, g6, g7, g8, g9, g10, g11, g12, g13, g14];
