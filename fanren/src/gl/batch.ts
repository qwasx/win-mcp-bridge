// 顶点批次：所有特效都化为带 UV 与预乘颜色的三角形，一次绘制调用画完。
// 颜色约定：add=1 为纯加色（发光），add=0 为普通覆盖（墨、烟）；介于之间可混合。
import { cellUV } from './atlas';

export const FLOATS = 8; // x y u v r g b a

export interface Seg { tex: WebGLTexture | null; start: number; count: number }

export class Batch {
  data = new Float32Array(FLOATS * 6 * 4096);
  n = 0; // 顶点数
  segs: Seg[] = [];
  private cur: WebGLTexture | null = null;
  // 屏幕变换：世界 -> CSS 像素
  cx = 0; cy = 0; z = 1; hw = 0; hh = 0;

  reset(camX: number, camY: number, z: number, W: number, H: number, atlas: WebGLTexture | null) {
    this.n = 0; this.segs.length = 0; this.cur = null;
    this.cx = camX; this.cy = camY; this.z = z; this.hw = W / 2; this.hh = H / 2;
    this.tex(atlas);
  }
  tex(t: WebGLTexture | null) {
    if (t === this.cur && this.segs.length) return;
    const last = this.segs[this.segs.length - 1];
    if (last && last.count === 0) { last.tex = t; this.cur = t; return; }
    this.segs.push({ tex: t, start: this.n, count: 0 });
    this.cur = t;
  }
  private grow(v: number) {
    if ((this.n + v) * FLOATS <= this.data.length) return true;
    if (this.data.length >= FLOATS * 6 * 65536) return false;
    const d = new Float32Array(this.data.length * 2); d.set(this.data); this.data = d; return true;
  }
  sx(x: number) { return (x - this.cx) * this.z + this.hw; }
  sy(y: number) { return (y - this.cy) * this.z + this.hh; }

  private v(x: number, y: number, u: number, vv: number, r: number, g: number, b: number, a: number) {
    const d = this.data, i = this.n * FLOATS;
    d[i] = x; d[i + 1] = y; d[i + 2] = u; d[i + 3] = vv; d[i + 4] = r; d[i + 5] = g; d[i + 6] = b; d[i + 7] = a;
    this.n++;
  }

  /** 屏幕空间旋转四边形（CSS 像素）。col 为 0..1 RGB */
  quadS(cell: number, x: number, y: number, w: number, h: number, rot: number, r: number, g: number, b: number, a: number, add: number, uv?: [number, number, number, number], sq = 1) {
    if (a <= 0.002 || w < 0.05 || h < 0.05) return;
    if (x + w + h < -50 || y + w + h < -50 || x - w - h > this.hw * 2 + 50 || y - w - h > this.hh * 2 + 50) return;
    if (!this.grow(6)) return;
    const [u0, v0, u1, v1] = uv ?? cellUV(cell);
    const c = Math.cos(rot), s = Math.sin(rot), hw = w / 2, hh = h / 2;
    const ax = c * hw, ay = s * hw * sq, bx = -s * hh, by = c * hh * sq;   // sq：旋转后再纵向压扁（地面透视）
    const pr = r * a, pg = g * a, pb = b * a, pa = a * (1 - add);
    const x0 = x - ax - bx, y0 = y - ay - by; // 左上
    const x1 = x + ax - bx, y1 = y + ay - by; // 右上
    const x2 = x + ax + bx, y2 = y + ay + by; // 右下
    const x3 = x - ax + bx, y3 = y - ay + by; // 左下
    this.v(x0, y0, u0, v0, pr, pg, pb, pa); this.v(x1, y1, u1, v0, pr, pg, pb, pa); this.v(x2, y2, u1, v1, pr, pg, pb, pa);
    this.v(x0, y0, u0, v0, pr, pg, pb, pa); this.v(x2, y2, u1, v1, pr, pg, pb, pa); this.v(x3, y3, u0, v1, pr, pg, pb, pa);
    this.segs[this.segs.length - 1].count += 6;
  }
  /** 世界坐标四边形（尺寸亦为世界单位） */
  quad(cell: number, x: number, y: number, w: number, h: number, rot: number, r: number, g: number, b: number, a: number, add: number) {
    this.quadS(cell, this.sx(x), this.sy(y), w * this.z, h * this.z, rot, r, g, b, a, add);
  }
  /** 地面贴花：贴图先在地面上旋转，再按透视压扁 */
  groundQuad(cell: number, x: number, y: number, r: number, rot: number, cr: number, cg: number, cb: number, a: number, add: number, squash: number) {
    this.quadS(cell, this.sx(x), this.sy(y), r * 2 * this.z, r * 2 * this.z, rot, cr, cg, cb, a, add, undefined, squash);
  }
  /** 整张纹理（神识圈等）世界坐标 */
  texQuad(x: number, y: number, size: number, rot: number, a: number, add: number, tint: [number, number, number] = [1, 1, 1], sy = 1) {
    this.quadS(-1, this.sx(x), this.sy(y), size * this.z, size * this.z, rot, tint[0], tint[1], tint[2], a, add, [0, 0, 1, 1], sy);
  }

  /** 折线条带（世界坐标）。w(i) 返回世界宽度，al(i) 返回该点透明度 */
  strip(cell: number, pts: ArrayLike<number>, n: number, w: (i: number) => number, al: (i: number) => number, r: number, g: number, b: number, add: number) {
    if (n < 2 || !this.grow((n - 1) * 6)) return;
    const [u0, v0, u1, v1] = cellUV(cell);
    const um = (u0 + u1) / 2;
    let pxL = 0, pyL = 0, pxR = 0, pyR = 0, pa = 0;
    let added = 0;
    for (let i = 0; i < n; i++) {
      const x = this.sx(pts[i * 2]), y = this.sy(pts[i * 2 + 1]);
      const j0 = Math.max(0, i - 1), j1 = Math.min(n - 1, i + 1);
      let dx = this.sx(pts[j1 * 2]) - this.sx(pts[j0 * 2]), dy = this.sy(pts[j1 * 2 + 1]) - this.sy(pts[j0 * 2 + 1]);
      const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
      const hw = w(i) * this.z * 0.5;
      const lx = x - dy * hw, ly = y + dx * hw, rx = x + dy * hw, ry = y - dx * hw;
      const a = Math.max(0, al(i));
      if (i > 0) {
        const ca = pa, cb = a;
        const P = (aa: number) => [r * aa, g * aa, b * aa, aa * (1 - add)] as const;
        const A = P(ca), B = P(cb);
        this.v(pxL, pyL, um, v0, A[0], A[1], A[2], A[3]); this.v(pxR, pyR, um, v1, A[0], A[1], A[2], A[3]); this.v(rx, ry, um, v1, B[0], B[1], B[2], B[3]);
        this.v(pxL, pyL, um, v0, A[0], A[1], A[2], A[3]); this.v(rx, ry, um, v1, B[0], B[1], B[2], B[3]); this.v(lx, ly, um, v0, B[0], B[1], B[2], B[3]);
        added += 6;
      }
      pxL = lx; pyL = ly; pxR = rx; pyR = ry; pa = a;
    }
    this.segs[this.segs.length - 1].count += added;
  }
}
