/* ヘッドレス環境でのスモークテスト：
   キャンバス2Dをモックして、シーン構築が最後まで通るか検証する */
import * as THREE from 'three';

function mockCtx(canvas) {
  const noop = () => {};
  const grad = { addColorStop: noop };
  return {
    canvas,
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    lineCap: 'butt',
    font: '',
    textAlign: 'left',
    textBaseline: 'top',
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    save: noop,
    restore: noop,
    translate: noop,
    rotate: noop,
    scale: noop,
    beginPath: noop,
    closePath: noop,
    moveTo: noop,
    lineTo: noop,
    arc: noop,
    rect: noop,
    roundRect: noop,
    fill: noop,
    stroke: noop,
    fillRect: noop,
    strokeRect: noop,
    clearRect: noop,
    fillText: noop,
    strokeText: noop,
    drawImage: noop,
    measureText: () => ({ width: 10 }),
    createRadialGradient: () => grad,
    createLinearGradient: () => grad,
    createPattern: () => null,
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    putImageData: noop,
  };
}

globalThis.document = {
  createElement(tag) {
    if (tag !== 'canvas') throw new Error('unexpected element ' + tag);
    const c = { width: 1, height: 1, style: {}, nodeName: 'CANVAS' };
    c.getContext = () => mockCtx(c);
    return c;
  },
  createElementNS() {
    return this.createElement('canvas');
  },
};
globalThis.window = { innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1, addEventListener() {} };
globalThis.self = globalThis;
globalThis.HTMLCanvasElement = function () {};
globalThis.ImageData = function () {};

const { buildGround } = await import('../src/ground.js');
const { buildStore } = await import('../src/store.js');
const { buildProps } = await import('../src/props.js');
const { buildRain, buildDrips, buildGlassRain } = await import('../src/rain.js');
const { RAMP3, RAMP4, gU, syncLightSources, getLightSources } = await import('../src/materials.js');

const scene = new THREE.Scene();
const api = { ramp3: RAMP3, ramp4: RAMP4 };

console.time('build');
buildGround(scene, api);
const store = buildStore(scene);
const props = buildProps(scene);
console.timeEnd('build');

const rain = buildRain(scene);
const drips = buildDrips(scene, store.canopy);
const glass = buildGlassRain(scene, store.glassPanes);
syncLightSources();

scene.updateMatrixWorld(true);

let meshes = 0;
let tris = 0;
const box = new THREE.Box3();
scene.traverse((o) => {
  if (o.isMesh || o.isInstancedMesh) {
    meshes++;
    const g = o.geometry;
    const count = g.index ? g.index.count : g.attributes.position.count;
    tris += (count / 3) * (o.isInstancedMesh ? o.count : 1);
    g.computeBoundingBox();
    if (!Number.isFinite(g.boundingBox.min.x)) return;
    const b = g.boundingBox.clone().applyMatrix4(o.matrixWorld);
    box.union(b);
  }
});

console.log('meshes        :', meshes);
console.log('triangles     :', Math.round(tris));
console.log('light sources :', getLightSources().length, '/', gU.uLPos.value.length);
console.log('scene bounds  :', box.min.toArray().map((v) => v.toFixed(2)).join(', '), '→', box.max.toArray().map((v) => v.toFixed(2)).join(', '));
console.log('flickers      :', store.flickers.length + props.flickers.length);
console.log('glass panes   :', store.glassPanes.length);

// 簡易アニメーション更新
for (let i = 0; i < 5; i++) {
  drips.update(i * 0.016, 0.016);
  glass.update(i * 0.016);
  rain.mat.uniforms.uTime.value = i * 0.016;
}
console.log('animation ok');
