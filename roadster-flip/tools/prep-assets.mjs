// 资产预处理：Draco 压缩的 Roadster GLB → Meshopt 压缩（three 的 MeshoptDecoder 自带 wasm，
// 可内嵌进 app.js，file:// 离线打开无需额外加载解码器）。
// 用法：node tools/prep-assets.mjs <roadster-draco.glb> src/assets/roadster.glb
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression, KHRDracoMeshCompression } from '@gltf-transform/extensions';
import { reorder, quantize, prune, dedup } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { MeshoptEncoder } from 'meshoptimizer';
const [, , src, dst] = process.argv;
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(), 'meshopt.encoder': MeshoptEncoder,
});
const doc = await io.read(src);
doc.getRoot().listExtensionsUsed().filter((e) => e.extensionName === KHRDracoMeshCompression.EXTENSION_NAME).forEach((e) => e.dispose());
await doc.transform(dedup(), prune(), reorder({ encoder: MeshoptEncoder }), quantize());
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
await io.write(dst, doc);
console.log('ok');
