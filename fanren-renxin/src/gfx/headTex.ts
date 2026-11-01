// 头部贴图：按需异步加载 + 多级预缩小（避免 300px 原图直接缩到 20px 的锯齿/闪烁）
// Node 测试环境没有 Image，自动跳过，继续用代码绘制的头。
export type HeadView = 'front' | 'q' | 'side' | 'qb' | 'back';

interface HeadImg { mips: HTMLCanvasElement[]; w: number; h: number; neckX: number; topY: number }
const sets = new Map<string, Partial<Record<HeadView, HeadImg>>>();
let started = false;

function makeMips(im: HTMLImageElement): HeadImg {
  // 原图：略提对比/饱和，让淡彩脸在游戏画面里不发灰
  const base = document.createElement('canvas'); base.width = im.width; base.height = im.height;
  const bg = base.getContext('2d')!; bg.filter = 'contrast(1.12) saturate(1.1)'; bg.drawImage(im, 0, 0);
  // 墨线剪影（与代码绘制身体的描边呼应）
  const sil = document.createElement('canvas'); sil.width = im.width; sil.height = im.height;
  const sg = sil.getContext('2d')!; sg.drawImage(base, 0, 0); sg.globalCompositeOperation = 'source-in'; sg.fillStyle = 'rgba(28,22,16,0.9)'; sg.fillRect(0, 0, sil.width, sil.height);
  const mips: HTMLCanvasElement[] = [];
  let w = im.width, h = im.height;
  for (;;) {
    const c = document.createElement('canvas'); const pad = 2; c.width = w; c.height = h;
    const g = c.getContext('2d')!; g.imageSmoothingQuality = 'high';
    const r = Math.max(0.7, h * 0.0075);
    for (let k = 0; k < 8; k++) { const t = k / 8 * Math.PI * 2; g.drawImage(sil, Math.cos(t) * r, Math.sin(t) * r, w, h); }
    g.drawImage(base, 0, 0, w, h);
    void pad;
    mips.push(c);
    if (w < 24 || h < 24) break;
    w = Math.max(1, Math.round(w / 2)); h = Math.max(1, Math.round(h / 2));
  }
  // 脖子中心（最底下 4% 行的不透明像素中心）与最顶端，用于锚定
  const c0 = base, g0 = bg;
  const d = g0.getImageData(0, 0, c0.width, c0.height).data;
  let sx = 0, n = 0, top = 0;
  for (let y = Math.floor(c0.height * 0.96); y < c0.height; y++) for (let x = 0; x < c0.width; x++) if (d[(y * c0.width + x) * 4 + 3] > 128) { sx += x; n++; }
  outer: for (let y = 0; y < c0.height; y++) for (let x = 0; x < c0.width; x++) if (d[(y * c0.width + x) * 4 + 3] > 128) { top = y; break outer; }
  return { mips, w: im.width, h: im.height, neckX: n ? sx / n / im.width : 0.5, topY: top / im.height };
}

export function loadHeadTex() {
  if (started || typeof Image === 'undefined' || typeof document === 'undefined') return;
  started = true;
  import('./headTexData').then(({ HEAD_SRC }) => {
    for (const [name, views] of Object.entries(HEAD_SRC)) {
      const set: Partial<Record<HeadView, HeadImg>> = {};
      let left = Object.keys(views).length;
      for (const [v, url] of Object.entries(views)) {
        const im = new Image();
        im.onload = () => { set[v as HeadView] = makeMips(im); if (--left === 0) sets.set(name, set); };
        im.onerror = () => { console.warn('头部贴图加载失败', name, v); };
        im.src = url;
      }
    }
  }).catch((e) => console.warn('头部贴图不可用', e));
}

/** 取某角色某角度的头部贴图；targetH 为屏幕像素高度，返回合适的那一级 */
export function headTex(name: string, view: HeadView, targetH: number): { src: HTMLCanvasElement; img: HeadImg } | null {
  const set = sets.get(name); if (!set) return null;
  const img = set[view]; if (!img) return null;
  let src = img.mips[0];
  for (const m of img.mips) { if (m.height >= targetH * 1.6) src = m; else break; }
  return { src, img };
}
export function headTexReady(name: string) { return sets.has(name); }
