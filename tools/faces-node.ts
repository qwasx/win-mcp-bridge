// Node 截图环境里加载 AI 脸（浏览器里由 faceTex.loadFaceTex 异步加载）
import { readFileSync } from 'fs';
import { loadImage } from '@napi-rs/canvas';
import { injectFace, type FaceView } from '../src/gfx/faceTex';

export async function loadFacesNode(): Promise<Record<string, { sex: 'm' | 'f'; skin: string }>> {
  const dir = new URL('../src/assets/faces/', import.meta.url);
  const info = JSON.parse(readFileSync(new URL('faces.json', dir), 'utf8'));
  for (const [id, d] of Object.entries<any>(info)) {
    for (const [v, x] of Object.entries<any>(d.views)) {
      const im = await loadImage(readFileSync(new URL(x.file, dir)));
      injectFace(id, v as FaceView, im, { cx: x.cx, cy: x.cy, ppu: x.ppu });
    }
  }
  return info;
}
