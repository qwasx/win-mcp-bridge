// 精灵生成 Worker：山（~40ms）与树（含 getImageData 回读）放到后台线程生成，主线程不再卡顿。
// 生成完转成 ImageBitmap 零拷贝传回。
import { setCanvasFactory } from '../core/canvas';
import { makeMountain, type MtnSpec, type MtnSprite } from './mountain';
import { makeTree, type Species, type Season } from './tree';

setCanvasFactory((w, h) => new OffscreenCanvas(w, h) as unknown as HTMLCanvasElement);

export type SpriteJob =
  | { id: number; kind: 'M'; spec: MtnSpec }
  | { id: number; kind: 'T'; sp: Species; season: Season; seed: number; res: number };
export interface SpriteDone { id: number; bmp?: ImageBitmap; w: number; h: number; ax: number; ay: number; falls?: MtnSprite['falls']; err?: string }

const toBitmap = (c: HTMLCanvasElement): ImageBitmap => (c as unknown as OffscreenCanvas).transferToImageBitmap();

self.onmessage = (e: MessageEvent<SpriteJob>) => {
  const j = e.data;
  try {
    if (j.kind === 'M') {
      const m = makeMountain(j.spec);
      const bmp = toBitmap(m.canvas as HTMLCanvasElement);
      (self as unknown as Worker).postMessage({ id: j.id, bmp, w: m.w, h: m.h, ax: m.ax, ay: m.ay, falls: m.falls } as SpriteDone, [bmp]);
    } else {
      const t = makeTree(j.sp, j.season, j.seed, j.res);
      const bmp = toBitmap(t.canvas);
      (self as unknown as Worker).postMessage({ id: j.id, bmp, w: t.w, h: t.h, ax: t.ax, ay: t.ay } as SpriteDone, [bmp]);
    }
  } catch (err) {
    (self as unknown as Worker).postMessage({ id: j.id, w: 0, h: 0, ax: 0, ay: 0, err: String(err) } as SpriteDone);
  }
};
