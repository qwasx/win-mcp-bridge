// 第二十五步：野外动物贴图（外部 AI 绘制的静态立绘，动作全由代码驱动：步态起伏、跳跃压缩、呼吸、振翅、转向）
import { AMB_DIM } from './ambDims';
type G = CanvasRenderingContext2D;
let SRC: Record<string, string> | null = null, loading = false;
const IMG = new Map<string, HTMLImageElement>();
function load() { if (SRC || loading) return; loading = true; import('./ambData').then((m) => { SRC = m.AMB_SRC; }).catch(() => { loading = false; }); }
function img(k: string): HTMLImageElement | null {
  if (!SRC) { load(); return null; }
  let im = IMG.get(k);
  if (!im) { const u = SRC[k]; if (!u || typeof Image === 'undefined') return null; im = new Image(); im.src = u; IMG.set(k, im); }
  return im.complete && im.naturalWidth > 0 ? im : null;
}
export function ambDim(k: string) { return AMB_DIM[k]; }
/** 画一只动物：(x, y) 为脚底中点；flip 朝左；sx/sy 形变（呼吸、压缩、振翅）；rot 绕脚底旋转 */
export function drawAmb(g: G, k: string, x: number, y: number, o: { flip?: boolean; s?: number; sx?: number; sy?: number; rot?: number; alpha?: number; ay?: number } = {}): boolean {
  const D = AMB_DIM[k]; const im = D && img(k); if (!im) return false;
  const s = o.s ?? 1, w = D.w * s * (o.sx ?? 1), h = D.h * s * (o.sy ?? 1), ay = o.ay ?? 1;
  g.save(); g.translate(x, y); if (o.rot) g.rotate(o.rot); if (o.flip) g.scale(-1, 1);
  if (o.alpha !== undefined) g.globalAlpha *= o.alpha;
  g.drawImage(im, -w / 2, -h * ay, w, h);
  g.restore();
  return true;
}
