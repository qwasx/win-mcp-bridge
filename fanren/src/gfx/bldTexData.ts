// 建筑贴图（国风淡彩，AI 绘制后抠图）。以 data URL 内联：双击 index.html（file://）运行时画布不会被“污染”，WebGL 仍可上传。
import hall_grey from '../assets/bld/hall_grey.webp?inline';
import hall_jade from '../assets/bld/hall_jade.webp?inline';
import hall_dark from '../assets/bld/hall_dark.webp?inline';
import hall_rose from '../assets/bld/hall_rose.webp?inline';
import pagoda from '../assets/bld/pagoda.webp?inline';
import paifang from '../assets/bld/paifang.webp?inline';
import house_a from '../assets/bld/house_a.webp?inline';
import house_b from '../assets/bld/house_b.webp?inline';
import hut from '../assets/bld/hut.webp?inline';
import yurt from '../assets/bld/yurt.webp?inline';

export const BLD_SRC: Record<string, string> = { hall_grey, hall_jade, hall_dark, hall_rose, pagoda, paifang, house_a, house_b, hut, yurt };
