// 测试专用的 Node 加载钩子：Node 无法直接加载图片 / 音频 / 字体（包括 `?inline` 写法），
// 统一替换为空字符串导出。游戏逻辑（数值、事件、对话）不依赖这些素材的字节内容。
// 由 tools/env.ts 注册，所有 `npx tsx tools/test-*.ts` 共用。
const ASSET = /\.(webp|png|jpe?g|gif|ogg|mp3|wav|m4a|woff2?|ttf|svg)(\?.*)?$/i;

export async function resolve(specifier, context, next) {
  if (ASSET.test(specifier) && context.parentURL) {
    const base = specifier.replace(/\?.*$/, '');
    return { url: new URL(base, context.parentURL).href + '?stub', shortCircuit: true, format: 'module' };
  }
  return next(specifier, context);
}

export async function load(url, context, next) {
  if (url.endsWith('?stub')) return { format: 'module', source: 'export default "";', shortCircuit: true };
  return next(url, context);
}
