// v0.42：地图名胜小景世界尺寸（独立于 Vite 的 ?inline 画材模块，供 Node 测试安全读取）。
import type { BldDim } from './bld2Dims';

// 世界尺寸：韩立约 108 像素高；取图像裁切比例 934:1003。
export const MAP_ART_DIMS: Record<string, BldDim> = {
  p_map42_hf_pavilion: { w: 580, h: 623 },
};
