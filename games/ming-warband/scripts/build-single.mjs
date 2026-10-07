// 构建单文件版本：所有 JS/CSS 内联到一个 HTML，双击即可在浏览器中游玩
import { build } from 'vite';
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';

const outDir = 'dist-single-tmp';
await build({
  configFile: false,
  base: './',
  logLevel: 'warn',
  build: {
    outDir, emptyOutDir: true, modulePreload: false, cssCodeSplit: false, assetsInlineLimit: 100000000, chunkSizeWarningLimit: 5000,
    rollupOptions: { output: { format: 'iife' } },
  },
});
const html = readFileSync(join(outDir, 'index.html'), 'utf8');
const assets = readdirSync(join(outDir, 'assets'));
const js = assets.filter(f => f.endsWith('.js')).map(f => readFileSync(join(outDir, 'assets', f), 'utf8')).join('\n');
const css = assets.filter(f => f.endsWith('.css')).map(f => readFileSync(join(outDir, 'assets', f), 'utf8')).join('\n');
let out = html
  .replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g, '')
  .replace(/<link[^>]*rel="stylesheet"[^>]*>/g, '')
  .replace('</head>', `<style>${css}</style>\n</head>`)
  .replace('</body>', () => `<script>${js.replace(/<\/script/gi, '<\\/script')}</script>\n</body>`);
mkdirSync('dist-single', { recursive: true });
writeFileSync('dist-single/铁血大明.html', out);
console.log('已生成 dist-single/铁血大明.html', (out.length / 1024 / 1024).toFixed(2), 'MB');
