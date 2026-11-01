// 测试用：让 node 认得素材导入（.webp/.png/.ogg/字体/css……，含 ?inline / ?url），一律返回占位 data URL
const RE = /\.(webp|png|jpe?g|gif|svg|ogg|mp3|wav|m4a|woff2?|ttf|css)(\?.*)?$/i;
export async function resolve(spec, ctx, next) {
  if (RE.test(spec)) return { url: new URL(spec.replace(/\?.*$/, ''), ctx.parentURL).href + '#asset', shortCircuit: true, format: 'module' };
  return next(spec, ctx);
}
export async function load(url, ctx, next) {
  if (url.endsWith('#asset')) return { format: 'module', source: 'export default "data:image/png;base64,iVBORw0KGgo=";', shortCircuit: true };
  return next(url, ctx);
}
