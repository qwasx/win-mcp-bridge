// AI 绘制的脸（只有脸，头发、头饰仍由代码画）：
// 每张脸按代码头渲染的"底稿"生成（tools/face-template.ts），所以图里头部中心与比例已知，
// 游戏里按头部中心 + 当前缩放贴上去，再裁进代码头的轮廓里，位置天然对齐。
// 四个角度：正、3/4 正、侧、3/4 背（另一侧镜像）；正背面没有脸，用代码。
export type FaceView = 'front' | 'q' | 'side' | 'qb';
/** 各角度底稿的朝向（yaw） */
export const FACE_VIEWS: Record<FaceView, number> = { front: 0, q: Math.PI / 4, side: Math.PI / 2, qb: Math.PI * 3 / 4 };
/** 底稿的渲染比例与画布边长（改了要重新生成全部脸） */
export const FACE_TPL_SCALE = 34, FACE_TPL_SIZE = 768;

/** cx/cy：头部中心在图里的像素位置；ppu：每个头部单位多少像素 */
export interface FaceSrc { url: string; cx: number; cy: number; ppu: number }
interface FaceImg { mips: HTMLCanvasElement[]; w: number; h: number; cx: number; cy: number; ppu: number }
const sets = new Map<string, Partial<Record<FaceView, FaceImg>>>();
let started = false;

function makeMips(im: CanvasImageSource & { width: number; height: number }, f: Omit<FaceSrc, 'url'>): FaceImg {
  // 淡墨外轮廓已在生成时烘进图里（_frame_work/face_build.py）
  const W = im.width, H = im.height;
  const base = document.createElement('canvas'); base.width = W; base.height = H;
  base.getContext('2d')!.drawImage(im, 0, 0);
  const mips: HTMLCanvasElement[] = [base];
  let src: HTMLCanvasElement = base, w = W, h = H;
  while (w >= 24 && h >= 24) {
    w = Math.max(1, Math.round(w / 2)); h = Math.max(1, Math.round(h / 2));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d')!; g.imageSmoothingQuality = 'high'; g.drawImage(src, 0, 0, w, h);
    mips.push(c); src = c;
  }
  return { mips, w: W, h: H, cx: f.cx, cy: f.cy, ppu: f.ppu };
}

export function loadFaceTex() {
  if (started || typeof Image === 'undefined' || typeof document === 'undefined') return;
  started = true;
  import('./faceTexData').then(({ FACE_SRC }) => {
    for (const [name, views] of Object.entries(FACE_SRC)) {
      const set: Partial<Record<FaceView, FaceImg>> = {};
      sets.set(name, set);
      for (const [v, s] of Object.entries(views)) {
        const im = new Image();
        im.onload = () => { set[v as FaceView] = makeMips(im, s); };
        im.onerror = () => console.warn('脸部贴图加载失败', name, v);
        im.src = s.url;
      }
    }
  }).catch((e) => console.warn('脸部贴图不可用', e));
}

/** 取某张脸某角度的贴图；S 为当前的人物缩放（屏幕像素 / 头部单位），返回合适的那一级与缩放倍数 */
export function faceTex(name: string, view: FaceView, S: number): { src: HTMLCanvasElement; img: FaceImg; k: number } | null {
  const img = sets.get(name)?.[view]; if (!img) return null;
  const k = S / img.ppu;
  let src = img.mips[0];
  for (const m of img.mips) { if (m.width >= img.w * k * 1.4) src = m; else break; }
  return { src, img, k };
}

/** Node 截图/测试环境：直接塞入已解码的图（tools 用） */
export function injectFace(name: string, view: FaceView, im: any, f: Omit<FaceSrc, 'url'>) {
  let set = sets.get(name); if (!set) { set = {}; sets.set(name, set); }
  set[view] = makeMips(im, f);
}
