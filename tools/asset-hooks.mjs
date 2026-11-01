// 用法：npx tsx --import ./tools/asset-hooks.mjs tools/test-renxin-game.ts
import { register } from 'node:module';
register('./asset-loader.mjs', import.meta.url);
// 图片永远不「加载完」：贴图走程序化回退，不影响逻辑测试
globalThis.Image ??= class { constructor() { this.complete = false; this.width = 0; this.height = 0; this.naturalWidth = 0; } set src(v) { this._s = v; } get src() { return this._s; } addEventListener() {} decode() { return new Promise(() => {}); } };
globalThis.requestAnimationFrame ??= () => 0;
globalThis.performance ??= { now: () => Date.now() };
