// UI 用的小立绘（取人物精灵表第 0 帧），按 key 缓存 dataURL
import { buildFigureSheet, type FigureSpec } from './figures';
import { troopSpec, companionSpec } from './specs';
import { currentHeroSpec } from './phaserTex';
import { TROOPS } from '../data/troops';

const cache = new Map<string, string>();
const PLAYER_COL = 0xe0b040;

function toUrl(key: string, spec: FigureSpec): string {
  const hit = cache.get(key); if (hit) return hit;
  let url = '';
  try {
    const sh = buildFigureSheet(spec, false, 3);
    const src = sh.canvas as unknown as HTMLCanvasElement;
    const data = src.getContext('2d')!.getImageData(0, 0, sh.fw, sh.fh).data;
    let x0 = sh.fw, y0 = sh.fh, x1 = 0, y1 = 0;
    for (let y = 0; y < sh.fh; y++) for (let x = 0; x < sh.fw; x++) {
      if (data[(y * sh.fw + x) * 4 + 3] > 20) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    if (x1 < x0) { x0 = 0; y0 = 0; x1 = sh.fw - 1; y1 = sh.fh - 1; }
    const w = x1 - x0 + 3, hh = y1 - y0 + 3;
    const c = document.createElement('canvas'); c.width = w; c.height = hh;
    c.getContext('2d')!.drawImage(src, x0 - 1, y0 - 1, w, hh, 0, 0, w, hh);
    url = c.toDataURL('image/png');
  } catch { url = ''; }
  cache.set(key, url);
  return url;
}

function img(url: string, h: number, mounted: boolean) {
  const el = document.createElement('img');
  el.className = 'portrait' + (mounted ? ' mounted' : '');
  el.alt = '';
  el.style.height = `${h}px`; el.style.width = `${Math.round(h * (mounted ? 1.15 : 0.75))}px`;
  if (url) el.src = url; else el.style.visibility = 'hidden';
  return el;
}

export function troopPortrait(id: string, h = 40) {
  const t = TROOPS[id];
  return img(toUrl('t:' + id, troopSpec(id, PLAYER_COL)), h, !!t?.mounted);
}
export function companionPortrait(id: string, h = 40) {
  return img(toUrl('c:' + id, companionSpec(id, PLAYER_COL, false)), h, false);
}
export function heroPortrait(h = 64) {
  const spec = currentHeroSpec(false);
  return img(toUrl('h:' + JSON.stringify(spec), spec), h, false);
}
