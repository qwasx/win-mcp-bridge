import '@fontsource/noto-sans-jp/400.css';
import '@fontsource/noto-sans-jp/700.css';
import '@fontsource/noto-sans-jp/900.css';

import * as TX from './textures.js';

window.__maxAniso = 16;
await TX.ensureFonts();

const root = document.getElementById('root');

function show(label, texture, size = 512) {
  const div = document.createElement('div');
  div.className = 'item';
  const canvas = texture.image;
  const view = document.createElement('canvas');
  view.width = size;
  view.height = size;
  const ctx = view.getContext('2d');
  ctx.fillStyle = '#333';
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(canvas, 0, 0, size, size);
  div.appendChild(view);
  const cap = document.createElement('div');
  cap.textContent = `${label} (${canvas.width}x${canvas.height})`;
  div.appendChild(cap);
  root.appendChild(div);
}

show('road', TX.makeRoadTexture());
show('sidewalk', TX.makeSidewalkTexture());
show('puddle', TX.makePuddleTexture());
show('storeSign', TX.makeStoreSign());
show('vending0', TX.makeVendingFront(0));
show('facade', TX.makeBuildingFacade(3, 3, 0.28));
show('interiorFloor', TX.makeInteriorFloor());
show('garbage', TX.makeGarbageTexture());
