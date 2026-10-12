// 构建“前端托管在别处、联机服务器自己开”的 H5 包（例如无丸 Wovoon 的“自建后端 Web 应用”模式）
// 用法：MW_SERVER=wss://你的服务器域名/ws npm run build:h5
// 产物：dist-h5/（index.html + assets，全部相对路径）和 release/ming-warband-h5.zip
import { build } from 'vite';
import { execSync } from 'node:child_process';
import { rmSync, mkdirSync, existsSync } from 'node:fs';
const url = process.env.MW_SERVER;
if (!url || !/^wss?:\/\/.+/.test(url)) {
  console.error('请先指定联机服务器地址，例如：MW_SERVER=wss://xxxx.app.workbuddy.host/ws npm run build:h5');
  process.exit(1);
}
if (url.startsWith('ws://')) console.warn('注意：托管平台的页面是 https，浏览器会拦截 ws://，请使用 wss://');
process.env.VITE_MW_SERVER = url;
rmSync('dist-h5', { recursive: true, force: true });
await build({ configFile: 'vite.config.ts', build: { outDir: 'dist-h5', emptyOutDir: true } });
mkdirSync('release', { recursive: true });
if (existsSync('release/ming-warband-h5.zip')) rmSync('release/ming-warband-h5.zip');
execSync('cd dist-h5 && zip -qr ../release/ming-warband-h5.zip .');
console.log(`\n已生成 dist-h5/ 与 release/ming-warband-h5.zip（联机服务器：${url}）`);
