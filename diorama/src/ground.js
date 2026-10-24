import * as THREE from 'three';
import { toon } from './materials.js';
import { groundQuad, box, add, Batcher, xform } from './helpers.js';
import { makeRoadTexture, makeSidewalkTexture, makePuddleTexture, makeCanvas, toTexture, JP_FONT } from './textures.js';

function makePlateTexture(text) {
  const { c, ctx } = makeCanvas(512, 96);
  const g = ctx.createLinearGradient(0, 0, 0, 96);
  g.addColorStop(0, '#8d7a52');
  g.addColorStop(0.5, '#c9b283');
  g.addColorStop(1, '#7d6a45');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 96);
  ctx.strokeStyle = 'rgba(60,48,28,0.7)';
  ctx.lineWidth = 5;
  ctx.strokeRect(5, 5, 502, 86);
  ctx.fillStyle = '#3b3016';
  ctx.font = `700 44px ${JP_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 50);
  return toTexture(c);
}

export function buildGround(scene, api) {
  const roadTex = makeRoadTexture();
  const walkTex = makeSidewalkTexture();
  const puddleTex = makePuddleTexture();

  const roadMat = toon({
    name: 'road',
    map: roadTex,
    wet: 1.0,
    puddleMap: puddleTex,
    rippleScale: 1.6,
    rim: 0.05,
    ramp: api.ramp3,
  });
  const walkMat = toon({
    name: 'walk',
    map: walkTex,
    wet: 0.9,
    puddleMap: puddleTex,
    rippleScale: 1.9,
    rim: 0.06,
    ramp: api.ramp3,
  });

  const g = new THREE.Group();
  g.name = 'ground';
  scene.add(g);

  /* ---------------- 展示用の台座 ---------------- */
  const baseMat = toon({ color: 0x1b1d24, rim: 0.16, rimPower: 3.0, ramp: api.ramp3 });
  const baseEdge = toon({ color: 0x2a2d36, rim: 0.2, ramp: api.ramp3 });
  // 台座：路面(0.004)より確実に低くして埋まらないように
  const footer = add(g, box(17.0, 0.22, 17.0, baseEdge), 0, -1.12, 0);
  const body = add(g, box(16.5, 0.95, 16.5, baseMat), 0, -0.535, 0); // 上面 y=-0.06
  const top = add(g, box(16.05, 0.055, 16.05, baseMat), 0, -0.0325, 0); // 上面 y=-0.005
  [footer, body, top].forEach((m) => {
    m.receiveShadow = true;
    m.castShadow = true;
  });

  // ネームプレート
  const plateMat = toon({ map: makePlateTexture('雨の夜のコンビニ角'), rim: 0.4, rimColor: 0xffe0a0, ramp: api.ramp3 });
  const plate = add(g, box(2.6, 0.2, 0.04, plateMat), 0, -0.5, 8.27);
  plate.castShadow = false;

  /* ---------------- 路面 ---------------- */
  const road = new THREE.Group();
  road.add(groundQuad(-8, 1.0, 8, 8, 0.004, roadMat)); // 前面道路
  road.add(groundQuad(-6.6, -6.6, -5.2, 1.0, 0.004, roadMat)); // 路地
  road.add(groundQuad(-6.6, -8, 5.2, -6.6, 0.004, roadMat)); // 裏通り
  road.add(groundQuad(5.2, -4.6, 8, 1.0, 0.004, roadMat)); // 駐車場
  g.add(road);

  /* ---------------- 歩道 ---------------- */
  const curbMat = toon({ color: 0x6a6c71, rim: 0.1, ramp: api.ramp3 });
  const curb = add(g, box(10.4, 0.14, 7.6, curbMat), 0, 0.07, -2.8);
  curb.castShadow = true;
  curb.receiveShadow = true;
  g.add(groundQuad(-5.2, -6.6, 5.2, 1.0, 0.145, walkMat));

  /* ---------------- 側溝・グレーチング ---------------- */
  const grateMat = toon({ color: 0x14161b, rim: 0.05, ramp: api.ramp3 });
  const barMat = toon({ color: 0x4a4f57, rim: 0.35, rimColor: 0x9fb4d8, ramp: api.ramp3 });
  const bt = new Batcher();
  // 前面道路の側溝
  bt.addBox(16, 0.03, 0.24, grateMat, 0, 0.016, 1.12);
  for (let x = -7.8; x < 8; x += 0.34) {
    bt.addBox(0.035, 0.03, 0.2, barMat, x, 0.033, 1.12);
  }
  // 路地の側溝
  bt.addBox(0.24, 0.03, 7.6, grateMat, -6.5, 0.016, -2.8);
  for (let z = -6.5; z < 1.0; z += 0.34) {
    bt.addBox(0.2, 0.03, 0.035, barMat, -6.5, 0.033, z);
  }
  // 駐車場の集水枡
  bt.addBox(0.5, 0.03, 0.5, grateMat, 7.0, 0.016, 0.55);
  for (let i = 0; i < 6; i++) bt.addBox(0.44, 0.03, 0.03, barMat, 7.0, 0.033, 0.34 + i * 0.08);
  bt.build(g, { cast: false, receive: true });

  /* ---------------- 車止め（駐車場） ---------------- */
  const stopMat = toon({ color: 0xb9bec4, rim: 0.18, ramp: api.ramp3 });
  const stopBt = new Batcher();
  for (const cx of [6.05, 7.15]) {
    stopBt.addBox(0.9, 0.12, 0.16, stopMat, cx, 0.06, -4.05);
    stopBt.addBox(0.06, 0.12, 0.16, toon({ color: 0x8a8f96, ramp: api.ramp3 }), cx - 0.45, 0.06, -4.05);
  }
  stopBt.build(g);

  return { roadMat, walkMat, baseMat };
}
