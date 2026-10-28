import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// 让打包结果可直接双击 index.html（file://）运行：
// 输出单个 IIFE 脚本，并把 <script type="module"> 改为普通 defer 脚本
function fileProtocolCompat(): Plugin {
  return {
    name: 'file-protocol-compat',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml(html) {
      return html
        .replace(/<script type="module" crossorigin/g, '<script defer')
        .replace(/<script type="module"/g, '<script defer')
        .replace(/ crossorigin/g, '');
    },
  };
}

export default defineConfig({
  plugins: [react(), fileProtocolCompat()],
  base: './',
  build: {
    target: 'es2019',
    modulePreload: false,
    assetsInlineLimit: 0,
    rollupOptions: { output: { format: 'iife', inlineDynamicImports: true } },
  },
  server: { host: '0.0.0.0', port: 5173, allowedHosts: true },
  preview: { host: '0.0.0.0', port: 4173, allowedHosts: true },
});
