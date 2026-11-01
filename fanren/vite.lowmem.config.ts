// 低内存打包（2GB 机器也能打）：与 vite.config.ts 产物一致，但大块内联素材不经 rollup——
// 先以占位符打包，再由 tools/inject-inline.mjs 把 data URL 写回（?inline 图片/音效、CSS 里的字体）。
import base from './vite.config';
import path from 'path';
import { writeFileSync } from 'fs';
const map: string[] = [];
function inlineLater() {
  return {
    name: 'inline-later', enforce: 'pre' as const,
    async resolveId(src: string, imp?: string) {
      if (!src.endsWith('?inline') || !imp) return null;
      const f = src.slice(0, -7); if (!/\.(webp|png|jpe?g|gif|ogg|mp3|wav|m4a|woff2?|ttf)$/i.test(f)) return null;
      return '\0inl:' + path.resolve(path.dirname(imp.split('?')[0]), f);
    },
    load(id: string) { if (!id.startsWith('\0inl:')) return null; map.push(id.slice(5)); return `export default "__INL${map.length - 1}__";`; },
    closeBundle() { writeFileSync(path.resolve('dist/.inl.json'), JSON.stringify(map)); },
  };
}
const b: any = (base as any).build;
export default { ...base, plugins: [inlineLater(), ...((base as any).plugins ?? [])], build: { ...b, reportCompressedSize: false, assetsInlineLimit: () => false, minify: process.env.NOMIN ? false : 'esbuild' } };
