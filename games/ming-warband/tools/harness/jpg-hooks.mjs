export async function load(url, context, next) {
  if (/\.(jpg|png|mp3|ogg)$/.test(url)) return { format: 'module', source: `export default ${JSON.stringify(url)};`, shortCircuit: true };
  return next(url, context);
}
