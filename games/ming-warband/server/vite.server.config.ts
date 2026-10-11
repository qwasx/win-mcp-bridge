// 服务器打包：单文件 server.mjs（含 ws），部署时无需 npm install
import { defineConfig } from 'vite';
export default defineConfig({
  build: {
    ssr: 'server/main.ts',
    outDir: 'dist-server',
    emptyOutDir: true,
    target: 'node22',
    minify: false,
    rollupOptions: { output: { entryFileNames: 'server.mjs', format: 'es' } },
  },
  ssr: { noExternal: true, target: 'node' },
});
