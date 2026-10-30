// 第十七步：河道几何的 CPU 镜像 —— 与地表着色器（gl/ground.ts）里的河曲域扭曲、宽窄变化逐式一致，
// 用来让草丛、树木、奇遇、妖兽不再长在 / 站在河面上。
// 着色器噪声 N4 是一张 512² 可平铺五次值噪声纹理（32 格一周期，4 通道不同种子），这里按同样的种子解析重建。

const G = 32;
const GRIDS: Float32Array[] = [0, 1, 2, 3].map((ch) => {
  let s = 1234567 + ch * 7919;
  const g = new Float32Array(G * G);
  for (let i = 0; i < g.length; i++) { s = (s * 16807) % 2147483647; g[i] = s / 2147483647; }
  return g;
});
const q5 = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
/** N4(p).ch：p 为着色器里的噪声坐标（周期 32） */
export function n4(px: number, py: number, ch: number) {
  const g = GRIDS[ch];
  const fx = ((px % G) + G) % G, fy = ((py % G) + G) % G;
  const ix = Math.floor(fx), iy = Math.floor(fy);
  const tx = q5(fx - ix), ty = q5(fy - iy);
  const at = (i: number, j: number) => g[(j % G) * G + (i % G)];
  return (at(ix, iy) * (1 - tx) + at(ix + 1, iy) * tx) * (1 - ty) + (at(ix, iy + 1) * (1 - tx) + at(ix + 1, iy + 1) * tx) * ty;
}
/** fbm2：与 GLSL 同式（RT = mat2(0.8,0.6,-0.6,0.8)，列主序） */
export function fbm2(px: number, py: number) {
  let s = n4(px, py, 0) * 0.66;
  const x2 = (0.8 * px - 0.6 * py) * 2.03 + 3.1, y2 = (0.6 * px + 0.8 * py) * 2.03 + 7.7;
  s += n4(x2, y2, 3) * 0.34;
  return s;
}
/** 河曲域扭曲（世界像素） */
export function riverWarp(wx: number, wy: number): [number, number] {
  return [
    (fbm2(wx / 1250 + 71, wy / 1250 + 13) - 0.5) * 760 + (fbm2(wx / 300 + 5, wy / 300 + 3) - 0.5) * 110,
    (fbm2(wx / 1250 + 19, wy / 1250 + 57) - 0.5) * 760 + (fbm2(wx / 300 + 9, wy / 300 + 1) - 0.5) * 110,
  ];
}
/** 河面宽度系数 */
export function riverWidthK(wx: number, wy: number) {
  return Math.min(1.6, Math.max(0.55, 1 + (fbm2(wx / 1500 + 2, wy / 1500 + 6) - 0.5) * 1.3 + (fbm2(wx / 260, wy / 260) - 0.5) * 0.3));
}

/** 河段空间索引：[ax,ay,bx,by,宽,…] 每段 8 个数 */
export class RiverGeo {
  private cell = 1600;
  private grid = new Map<number, number[]>();
  constructor(private seg: Float32Array) {
    for (let i = 0; i < seg.length; i += 8) {
      const pad = seg[i + 4] + 500;
      const x0 = Math.floor((Math.min(seg[i], seg[i + 2]) - pad) / this.cell), x1 = Math.floor((Math.max(seg[i], seg[i + 2]) + pad) / this.cell);
      const y0 = Math.floor((Math.min(seg[i + 1], seg[i + 3]) - pad) / this.cell), y1 = Math.floor((Math.max(seg[i + 1], seg[i + 3]) + pad) / this.cell);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const k = y * 65536 + x; let a = this.grid.get(k); if (!a) this.grid.set(k, (a = [])); a.push(i); }
    }
  }
  /** 到水边的有符号距离（世界像素，负 = 在河里）；附近无河返回 1e9 */
  edgeDist(wx: number, wy: number) {
    const list = this.grid.get(Math.floor(wy / this.cell) * 65536 + Math.floor(wx / this.cell));
    if (!list) return 1e9;
    const [dx, dy] = riverWarp(wx, wy), qx = wx + dx, qy = wy + dy;
    const s = this.seg; let best = 1e9;
    for (const i of list) {
      const ax = s[i], ay = s[i + 1], bx = s[i + 2] - ax, by = s[i + 3] - ay;
      const h = Math.max(0, Math.min(1, ((qx - ax) * bx + (qy - ay) * by) / Math.max(bx * bx + by * by, 1e-3)));
      const d = Math.hypot(qx - ax - bx * h, qy - ay - by * h) - s[i + 4] * 0.5 * riverWidthK(wx, wy);
      if (d < best) best = d;
    }
    return best;
  }
  inWater(wx: number, wy: number, margin = 0) { return this.edgeDist(wx, wy) < margin; }
}
