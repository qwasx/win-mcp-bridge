import * as THREE from 'three';
import { toon, glow, neon, glass, RAMP3, RAMP4, registerLightSource } from './materials.js';
import { Batcher, ProductBatch, box, plane, cyl, sphere, add, place, fx } from './helpers.js';
import * as TX from './textures.js';

export const STORE = {
  ox0: -4.3,
  ox1: 4.3,
  oz0: -6.2,
  oz1: -0.8, // 外壁
  ix0: -4.1,
  ix1: 4.1,
  iz0: -6.0,
  iz1: -1.0, // 内壁
  floor: 0.16,
  ceil: 2.62,
  wallTop: 3.3,
  doorX: [-2.6, -1.0],
  glassY: [0.5, 2.35],
};

const PROD = [
  0xf2f4f7, 0xe4573f, 0xf0a92b, 0x3fae5a, 0x2f7fd8, 0x8a5fd0,
  0xe2658c, 0x2ba7a0, 0xf7e08a, 0xd9c7a8, 0x5b6b8c, 0xbfd8f0,
  0xe8c9d8, 0xc4e3b5, 0xf6f1e2, 0x8f6a4a,
];

function labelTex(text, { w = 256, h = 128, bg = '#1d63c8', fg = '#ffffff', size = 56 } = {}) {
  const { c, ctx } = TX.makeCanvas(w, h);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = fg;
  ctx.font = `800 ${size}px ${TX.JP_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2 + 2);
  return TX.toTexture(c);
}

/** 天地方向の UV を指定した平面（内装床など） */
function mappedQuad(x1, z1, x2, z2, y, mat, ox, oz, wx, wz, faceDown = false) {
  const geo = new THREE.PlaneGeometry(Math.abs(x2 - x1), Math.abs(z2 - z1));
  geo.rotateX(faceDown ? Math.PI / 2 : -Math.PI / 2);
  geo.translate((x1 + x2) / 2, y, (z1 + z2) / 2);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (pos.getX(i) - ox) / wx, (pos.getZ(i) - oz) / wz);
  }
  uv.needsUpdate = true;
  const m = new THREE.Mesh(geo, mat);
  m.receiveShadow = true;
  return m;
}

export function buildStore(scene) {
  const root = new THREE.Group();
  root.name = 'store';
  scene.add(root);

  const out = { flickers: [], doors: null, glassPanes: [], lightSources: [] };

  /* ------------------------------- マテリアル ------------------------------- */
  const M = {
    wallOut: toon({ color: 0xe6e2d7, rim: 0.28, ramp: RAMP4 }),
    wallTrim: toon({ color: 0xcbc6ba, rim: 0.22, ramp: RAMP4 }),
    wallIn: toon({ color: 0xf4f1e8, rim: 0.1, ramp: RAMP4 }),
    ceil: toon({ color: 0xf7f7f3, rim: 0.06, ramp: RAMP3 }),
    fascia: toon({ color: 0xd9dde2, rim: 0.26, ramp: RAMP4 }),
    metal: toon({ color: 0x9aa2ab, rim: 0.45, rimColor: 0xc2d6f2, ramp: RAMP4 }),
    metalDark: toon({ color: 0x5a6068, rim: 0.35, rimColor: 0x9fb6d8, ramp: RAMP4 }),
    dark: toon({ color: 0x2c3138, rim: 0.28, ramp: RAMP3 }),
    darker: toon({ color: 0x1a1e25, rim: 0.2, ramp: RAMP3 }),
    shelf: toon({ color: 0xf2f1ed, rim: 0.16, ramp: RAMP4 }),
    shelfEdge: toon({ color: 0x3f8fd0, rim: 0.2, ramp: RAMP4 }),
    floorIn: toon({ map: TX.makeInteriorFloor(), rim: 0.05, ramp: RAMP4 }),
    glass: glass({}),
    doorGlass: glass({ opacity: 0.1, rim: 0.22 }),
    coolGlow: glow({ color: 0xdff0ff, intensity: 0.9 }),
    warmGlow: glow({ color: 0xfff0cf, intensity: 1.15 }),
    panel: glow({ color: 0xfff6e6, intensity: 1.85 }),
    steel: toon({ color: 0x8b939c, rim: 0.4, ramp: RAMP4 }),
    wood: toon({ color: 0xb08754, rim: 0.2, ramp: RAMP4 }),
    white: toon({ color: 0xf7f7f5, rim: 0.14, ramp: RAMP4 }),
  };

  /* =============================== 外観 =============================== */
  const ext = new Batcher();
  const WY0 = 0.14;
  const WH = STORE.wallTop - WY0;
  const WCY = WY0 + WH / 2;

  // 側壁・奥壁
  ext.addBox(0.2, WH, 5.4, M.wallOut, -4.2, WCY, -3.5);
  ext.addBox(0.2, WH, 5.4, M.wallOut, 4.2, WCY, -3.5);
  ext.addBox(8.4, WH, 0.2, M.wallOut, 0, WCY, -6.1);
  // 正面：腰壁 / 上の壁
  ext.addBox(8.6, 0.36, 0.2, M.wallTrim, 0, 0.32, -0.9);
  ext.addBox(8.6, 0.04, 0.26, M.metal, 0, 0.51, -0.9);
  ext.addBox(8.6, 0.95, 0.2, M.wallOut, 0, 2.825, -0.9);
  // ドアまわり
  ext.addBox(1.68, 0.09, 0.2, M.wallOut, -1.8, 2.305, -0.9);
  ext.addBox(0.08, 2.24, 0.26, M.metalDark, -2.62, 1.24, -0.9);
  ext.addBox(0.08, 2.24, 0.26, M.metalDark, -0.98, 1.24, -0.9);
  ext.addBox(1.8, 0.2, 0.26, M.metalDark, -1.8, 2.4, -0.9);

  // 屋根・パラペット
  ext.addBox(8.8, 0.18, 5.6, M.wallTrim, 0, 3.39, -3.5);
  ext.addBox(8.8, 0.32, 0.12, M.wallOut, 0, 3.64, -0.78);
  ext.addBox(8.8, 0.32, 0.12, M.wallOut, 0, 3.64, -6.22);
  ext.addBox(0.12, 0.32, 5.6, M.wallOut, -4.36, 3.64, -3.5);
  ext.addBox(0.12, 0.32, 5.6, M.wallOut, 4.36, 3.64, -3.5);

  // ファサードの帯（看板下地）
  ext.addBox(8.9, 1.02, 0.14, M.fascia, 0, 2.92, -0.73);
  ext.addBox(8.9, 0.06, 0.17, toon({ color: 0x1d63c8, rim: 0.3 }), 0, 3.38, -0.715);
  ext.addBox(8.9, 0.05, 0.17, toon({ color: 0xe0463c, rim: 0.3 }), 0, 2.48, -0.715);
  ext.build(root);

  // 屋上の室外機など
  const roofB = new Batcher();
  for (const [rx, rz] of [
    [-2.3, -4.6],
    [-1.15, -4.6],
    [-2.3, -3.1],
  ]) {
    roofB.addBox(0.9, 0.62, 0.7, M.metal, rx, 3.79, rz);
    roofB.addBox(0.92, 0.05, 0.72, M.metalDark, rx, 4.12, rz);
    roofB.addCyl(0.24, 0.24, 0.04, M.darker, 12, rx, 4.16, rz, 0, Math.PI / 2);
  }
  roofB.addCyl(0.45, 0.45, 1.0, M.metal, 14, 1.9, 4.0, -3.2);
  roofB.addCyl(0.46, 0.46, 0.08, M.metalDark, 14, 1.9, 4.52, -3.2);
  roofB.addCyl(0.04, 0.04, 1.3, M.metalDark, 6, 3.0, 4.25, -5.4);
  roofB.addCyl(0.04, 0.04, 0.9, M.metalDark, 6, 3.4, 4.05, -5.4);
  roofB.addBox(0.35, 0.42, 0.35, M.metalDark, -3.4, 3.69, -2.2);
  roofB.build(root);

  /* ------------------------------ ひさし ------------------------------ */
  const canopyMat = toon({ color: 0xdfe3e6, rim: 0.3, ramp: RAMP4 });
  const canopy = add(root, box(9.2, 0.12, 2.3, canopyMat), 0.05, 2.78, 0.35);
  canopy.rotation.x = 0.05;
  const lip = add(root, box(9.3, 0.2, 0.1, M.metalDark), 0.05, 2.7, 1.44);
  lip.rotation.x = 0.05;
  const underGlow = add(root, box(8.4, 0.04, 0.14, glow({ color: 0xffe7bd, intensity: 1.0 })), 0.05, 2.63, 1.2);
  underGlow.rotation.x = 0.05;
  for (const px of [-4.35, 4.5]) {
    add(root, cyl(0.05, 0.05, 2.6, M.metalDark, 10), px, 1.45, 1.35);
  }
  const canopyB = new Batcher();
  canopyB.addBox(9.2, 0.06, 0.06, M.metalDark, 0.05, 2.62, 1.5);
  canopyB.build(root);
  out.canopy = { y: 2.62, z: 1.5, x0: -4.5, x1: 4.6 };

  /* ------------------------------ 看板 ------------------------------ */
  const signTex = TX.makeStoreSign();
  const signMat = neon({
    map: signTex,
    emissive: 0xffffff,
    emissiveMap: signTex,
    emissiveIntensity: 0.5,
    color: 0xaaaaaa,
    rim: 0.1,
  });
  const sign = add(root, plane(3.6, 0.88, signMat), -0.9, 2.95, -0.655);
  sign.name = 'storeSign';
  out.flickers.push({ mat: signMat, base: 0.5, amount: 0.12, speed: 2.1, jitter: 6.3 });

  // サービスマーク
  for (const [tx, tc, tb] of [
    [2.15, '#ffffff', '#1d63c8'],
    [3.15, '#ffffff', '#e0463c'],
  ]) {
    const t = labelTex(tx === 2.15 ? 'ATM' : '24h', { bg: tb, fg: tc, size: 64 });
    const m = neon({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.5, color: 0xaaaaaa });
    add(root, plane(0.72, 0.5, m), tx, 3.0, -0.655);
  }

  // 縦型看板
  const vTex = TX.makeVerticalSign();
  const vMat = neon({ map: vTex, emissive: 0xffffff, emissiveMap: vTex, emissiveIntensity: 0.5, color: 0xaaaaaa });
  add(root, box(0.58, 1.75, 0.18, M.dark), 4.05, 3.5, -0.6);
  add(root, plane(0.54, 1.62, vMat), 4.05, 3.5, -0.5);
  out.flickers.push({ mat: vMat, base: 0.5, amount: 0.2, speed: 5.5, jitter: 1.7 });

  /* --------------------------- ガラス・建具 --------------------------- */
  const gY0 = STORE.glassY[0];
  const gY1 = STORE.glassY[1];
  const gH = gY1 - gY0;
  const gCY = (gY0 + gY1) / 2;

  const pane = (x0, x1) => {
    const w = x1 - x0;
    const m = add(root, plane(w, gH, M.glass), (x0 + x1) / 2, gCY, -0.86);
    m.renderOrder = 3;
    out.glassPanes.push({ x0, x1, y0: gY0, y1: gY1, z: -0.86, mesh: m });
    return m;
  };
  pane(-4.1, -2.7);
  pane(-0.9, 4.1);

  // 方立
  const mull = new Batcher();
  for (const mx of [-2.7, -0.9, 0.5, 1.9, 3.1, 4.1]) {
    mull.addBox(0.07, gH, 0.1, M.metalDark, mx, gCY, -0.86);
  }
  mull.addBox(8.2, 0.07, 0.1, M.metalDark, 0, gY1, -0.86);
  mull.build(root);

  // 自動ドア
  const doorGroup = new THREE.Group();
  root.add(doorGroup);
  const makePanel = (side) => {
    const g = new THREE.Group();
    const gl = add(g, box(0.78, 2.0, 0.03, M.doorGlass), 0, 1.26, 0);
    gl.renderOrder = 4;
    const fr = new Batcher();
    fr.addBox(0.78, 0.06, 0.06, M.metalDark, 0, 2.28, 0);
    fr.addBox(0.78, 0.06, 0.06, M.metalDark, 0, 0.18, 0);
    fr.addBox(0.05, 2.0, 0.06, M.metalDark, -0.385, 1.26, 0);
    fr.addBox(0.05, 2.0, 0.06, M.metalDark, 0.385, 1.26, 0);
    fr.addBox(0.04, 0.5, 0.05, M.metal, side * 0.3, 1.26, 0.03);
    fr.build(g);
    const sticker = add(g, plane(0.4, 0.12, glow({ map: labelTex('自動ドア', { bg: '#f6f6f2', fg: '#3a4050', size: 44 }), intensity: 1.1 })), 0, 1.95, 0.025);
    sticker.renderOrder = 5;
    return g;
  };
  const dL = makePanel(-1);
  const dR = makePanel(1);
  dL.position.set(-2.2, 0, -0.83);
  dR.position.set(-1.4, 0, -0.83);
  doorGroup.add(dL, dR);
  out.doors = { left: dL, right: dR, closedL: -2.2, closedR: -1.4, open: 0.74 };

  // ドア上部のセンサー
  add(root, box(1.4, 0.08, 0.14, M.dark), -1.8, 2.26, -0.79);
  const sensor = add(root, box(0.1, 0.05, 0.06, glow({ color: 0xff6a5a, intensity: 1.8 })), -1.8, 2.21, -0.74);
  out.flickers.push({ mat: sensor.material, base: 1.8, amount: 1.1, speed: 3.3, jitter: 0.4 });

  /* ---------------------- 外壁の小物（路地側） ---------------------- */
  const sideB = new Batcher();
  // 雨樋
  sideB.addCyl(0.055, 0.055, 3.1, M.metalDark, 8, -4.42, 1.7, -5.75);
  sideB.addBox(0.1, 0.06, 0.1, M.metalDark, -4.42, 2.4, -5.75);
  sideB.addBox(0.1, 0.06, 0.1, M.metalDark, -4.42, 1.2, -5.75);
  // 室外機（壁掛け）
  sideB.addBox(0.86, 0.6, 0.32, M.metal, -4.56, 2.6, -3.9);
  sideB.addCyl(0.19, 0.19, 0.06, M.darker, 10, -4.72, 2.6, -3.9, 0, 0, Math.PI / 2);
  sideB.addBox(0.1, 0.06, 0.5, M.metalDark, -4.42, 2.24, -3.9);
  sideB.addBox(0.24, 0.24, 0.06, M.metalDark, -4.42, 2.24, -3.68);
  sideB.addBox(0.24, 0.24, 0.06, M.metalDark, -4.42, 2.24, -4.12);
  // 高い窓（明かりが漏れる）
  sideB.build(root);

  const winMat = glow({ color: 0xffe3ad, intensity: 0.95 });
  const sideWin = add(root, plane(0.62, 0.46, winMat), -4.42, 2.55, -1.75, -Math.PI / 2);
  const sideWinFrame = new Batcher();
  sideWinFrame.addBox(0.06, 0.58, 0.54, M.metalDark, -4.4, 2.55, -1.75);
  sideWinFrame.build(root);

  // 掲示板
  const bbTex = TX.makeBulletinBoard();
  const bbMat = toon({ map: bbTex, rim: 0.14, ramp: RAMP4 });
  add(root, box(0.08, 1.0, 1.3, M.wood), -4.42, 1.65, -2.9);
  add(root, plane(1.2, 0.9, bbMat), -4.47, 1.65, -2.9, -Math.PI / 2);
  add(root, box(0.1, 0.06, 0.42, M.metalDark), -4.5, 2.28, -2.9);
  const bbLamp = add(root, box(0.16, 0.06, 0.3, glow({ color: 0xffe6bb, intensity: 1.1 })), -4.55, 2.23, -2.9);
  out.bbLamp = bbLamp;

  // 路地側の小さな案内
  const alleyTex = TX.makeAlleySign();
  add(root, plane(1.2, 0.3, toon({ map: alleyTex, rim: 0.12, ramp: RAMP4 })), -4.42, 2.05, -5.1, -Math.PI / 2);

  /* ---------------------- 外壁の小物（裏側） ---------------------- */
  const backB = new Batcher();
  // 裏口
  backB.addBox(0.95, 2.14, 0.1, M.steel, 3.25, 1.21, -6.26);
  backB.addBox(0.5, 0.05, 0.5, M.metalDark, 3.25, 0.2, -6.4);
  backB.addBox(0.06, 0.06, 0.7, M.metal, 3.25, 1.15, -6.32);
  backB.addCyl(0.05, 0.05, 3.0, M.metalDark, 8, -3.4, 1.65, -6.42);
  // 室外機（置き型）
  for (const bx of [0.7, -0.5]) {
    backB.addBox(0.86, 0.66, 0.34, M.metal, bx, 0.53, -6.5);
    backB.addCyl(0.2, 0.2, 0.06, M.darker, 10, bx, 0.53, -6.69, 0, Math.PI / 2);
    backB.addBox(0.9, 0.06, 0.36, M.metalDark, bx, 0.2, -6.5);
  }
  // 換気口
  for (let i = 0; i < 5; i++) backB.addBox(0.5, 0.05, 0.04, M.metalDark, -2.2, 1.6 + i * 0.12, -6.31);
  backB.build(root);

  const exitTex = labelTex('非常口', { w: 256, h: 128, bg: '#123d22', fg: '#8ef0a8', size: 62 });
  const exitMat = glow({ map: exitTex, intensity: 1.15 });
  add(root, plane(0.5, 0.25, exitMat), 3.25, 2.45, -6.2);
  const doorPlate = add(root, plane(0.42, 0.16, toon({ map: TX.makeBackRoomSign(), rim: 0.1, ramp: RAMP4 })), 2.72, 1.9, -6.19);
  const backLamp = add(root, box(0.2, 0.08, 0.34, glow({ color: 0xffdfae, intensity: 1.2 })), 3.25, 2.24, -6.3);
  out.backLamp = backLamp;

  /* =============================== 内装 =============================== */
  const inner = new THREE.Group();
  inner.name = 'interior';
  root.add(inner);

  // 床・天井
  const floorMat = M.floorIn;
  inner.add(
    mappedQuad(STORE.ix0, STORE.iz0, STORE.ix1, STORE.iz1, STORE.floor, floorMat, -4.3, -6.2, 8.6, 5.4)
  );
  const ceil = mappedQuad(STORE.ix0, STORE.iz0, STORE.ix1, STORE.iz1, STORE.ceil, M.ceil, -4.3, -6.2, 8.6, 5.4, true);
  inner.add(ceil);

  // 天井照明
  const panels = [];
  for (const cx of [-3.0, -0.6, 1.8]) {
    for (const cz of [-1.9, -3.5, -5.1]) panels.push([cx, cz]);
  }
  panels.push([3.45, -2.1], [3.45, -3.6]);
  const panelB = new Batcher();
  panels.forEach(([cx, cz]) => {
    panelB.addBox(1.5, 0.05, 0.34, glow({ color: 0xfff4dc, intensity: 1.22 }), cx, 2.58, cz);
    panelB.addBox(1.58, 0.06, 0.42, M.white, cx, 2.62, cz);
  });
  panelB.build(inner, { cast: false, receive: false });

  // 天井カセットエアコン
  const acB = new Batcher();
  for (const [cx, cz] of [
    [-2.0, -3.2],
    [1.2, -4.3],
  ]) {
    acB.addBox(0.62, 0.1, 0.62, M.white, cx, 2.55, cz);
    acB.addBox(0.5, 0.03, 0.5, M.metalDark, cx, 2.49, cz);
  }
  acB.build(inner, { cast: false });

  // 防犯カメラ
  add(inner, cyl(0.05, 0.05, 0.12, M.white, 10), -2.4, 2.5, -1.2);
  add(inner, cyl(0.07, 0.02, 0.16, M.dark, 10), -2.4, 2.4, -1.2, 0, 0.5);

  const products = new ProductBatch(toon({ color: 0xffffff, rim: 0.1, ramp: RAMP4 }));
  const rnd = TX.mulberry32(2024);

  /* ---------------------------- ゴンドラ棚 ---------------------------- */
  function gondola(cx, z0, z1, { width = 0.72, levels = 4, refrig = false, hue = 0x3f8fd0, seed = 1 } = {}) {
    const g = new Batcher();
    const len = z1 - z0;
    const cz = (z0 + z1) / 2;
    const r = TX.mulberry32(seed);
    g.addBox(width, 0.14, len, M.metalDark, cx, STORE.floor + 0.07, cz);
    g.addBox(width, 0.05, len, M.shelf, cx, STORE.floor + 0.16, cz);
    g.addBox(0.05, 1.34, len, M.shelf, cx - width / 2 + 0.025, STORE.floor + 0.81, cz);
    g.addBox(0.05, 1.34, len, M.shelf, cx + width / 2 - 0.025, STORE.floor + 0.81, cz);
    g.addBox(width, 0.06, len, M.metal, cx, STORE.floor + 1.44, cz);
    if (refrig) {
      // 傾いたガラス面と庫内灯
      g.addBox(0.06, 0.9, len, M.metal, cx + width / 2 - 0.02, STORE.floor + 1.05, cz);
    }
    const edgeMat = toon({ color: hue, rim: 0.2, ramp: RAMP4 });
    for (let l = 0; l < levels; l++) {
      const y = STORE.floor + 0.34 + l * 0.28;
      g.addBox(width - 0.06, 0.035, len - 0.06, M.shelf, cx, y, cz);
      g.addBox(width - 0.02, 0.035, 0.05, edgeMat, cx, y + 0.03, z0 + 0.1);
      g.addBox(width - 0.02, 0.035, 0.05, edgeMat, cx, y + 0.03, z1 - 0.1);
      // 商品（両面）
      for (const side of [-1, 1]) {
        let z = z0 + 0.14;
        while (z < z1 - 0.16) {
          const w = 0.1 + r() * 0.06;
          const h = 0.12 + r() * 0.13;
          const d = 0.1 + r() * 0.05;
          const px = cx + side * (width / 2 - w / 2 - 0.045);
          products.add(px, y + 0.02 + h / 2, z + d / 2, w, h, d, PROD[Math.floor(r() * PROD.length)], 0);
          if (r() < 0.35) {
            const w2 = 0.1 + r() * 0.05;
            const h2 = 0.1 + r() * 0.1;
            products.add(
              px,
              y + 0.02 + h2 / 2,
              z + d + 0.04 + w2 / 2,
              w2,
              h2,
              0.09 + r() * 0.04,
              PROD[Math.floor(r() * PROD.length)]
            );
          }
          z += d + 0.03 + r() * 0.05;
        }
      }
    }
    g.build(inner, { cast: false, receive: true });
  }

  gondola(-3.4, -2.6, -5.0, { refrig: true, hue: 0x4fb56a, seed: 7 });
  gondola(-0.35, -2.6, -5.0, { hue: 0x3f8fd0, seed: 11 });
  gondola(0.85, -2.6, -5.0, { hue: 0xe08a2b, seed: 13 });
  gondola(2.05, -2.6, -5.0, { hue: 0xd9534f, seed: 17 });

  // ホンドラの端面陳列（窓から見える側）
  {
    const er = TX.mulberry32(99);
    for (const [gx, hue] of [
      [-3.4, 0x4fb56a],
      [-0.35, 0x3f8fd0],
      [0.85, 0xe08a2b],
      [2.05, 0xd9534f],
    ]) {
      for (let l = 0; l < 3; l++) {
        const y = STORE.floor + 0.42 + l * 0.34;
        for (let c = 0; c < 2; c++) {
          for (let r = 0; r < 2; r++) {
            products.add(
              gx - 0.16 + c * 0.32,
              y + r * 0.16,
              -2.5 + (er() - 0.5) * 0.02,
              0.26,
              0.15,
              0.16,
              PROD[Math.floor(er() * PROD.length)]
            );
          }
        }
      }
      // 端面のPOP
      const pop = add(inner, plane(0.34, 0.2, glow({ map: labelTex('おすすめ', { w: 256, h: 128, bg: '#e0463c', fg: '#ffffff', size: 54 }), intensity: 0.85 })), gx, STORE.floor + 1.28, -2.52);
      pop.renderOrder = 1;
    }
  }

  // 弁当ケース（左端）の庫内灯と値札
  const caseGlow = add(inner, plane(2.3, 0.3, glow({ color: 0xd6f2ff, intensity: 1.05 })), -3.02, 1.38, -3.8, Math.PI / 2);
  for (let i = 0; i < 4; i++) {
    add(inner, plane(0.34, 0.2, glow({ map: TX.makeBentoLabel(i), intensity: 1.05 })), -3.01, 0.62 + i * 0.28, -3.8, Math.PI / 2);
  }

  /* ------------------------------ 冷蔵ケース ------------------------------ */
  const coolerB = new Batcher();
  for (const cx of [-3.15, -1.55, 0.05]) {
    coolerB.addBox(1.5, 2.05, 0.65, M.metalDark, cx, STORE.floor + 1.025, -5.68);
    coolerB.addBox(1.42, 1.9, 0.06, glow({ color: 0xdff2ff, intensity: 0.8 }), cx, STORE.floor + 1.05, -5.98);
    for (let s = 0; s < 4; s++) {
      const y = STORE.floor + 0.45 + s * 0.42;
      coolerB.addBox(1.34, 0.04, 0.5, M.metal, cx, y, -5.7);
      coolerB.addBox(1.34, 0.03, 0.04, glow({ color: 0xbfe8ff, intensity: 1.1 }), cx, y + 0.28, -5.45);
      // 缶・ペットボトル
      for (let row = 0; row < 2; row++) {
        let x = cx - 0.62;
        while (x < cx + 0.6) {
          const w = 0.075 + rnd() * 0.03;
          const h = 0.16 + rnd() * 0.08;
          products.add(
            x + w / 2,
            y + 0.02 + h / 2,
            -5.72 + row * 0.2,
            w,
            h,
            0.14,
            PROD[Math.floor(rnd() * PROD.length)]
          );
          x += w + 0.02;
        }
      }
    }
    coolerB.addBox(1.46, 1.92, 0.03, M.glass, cx, STORE.floor + 1.05, -5.38);
    coolerB.addBox(0.06, 1.9, 0.06, M.metal, cx + 0.62, STORE.floor + 1.05, -5.35);
    coolerB.addBox(1.5, 0.12, 0.68, toon({ color: 0x2f7fd8, rim: 0.2, ramp: RAMP4 }), cx, STORE.floor + 2.12, -5.68);
  }
  coolerB.build(inner, { cast: false, receive: false });

  // 冷蔵ケース上部の灯箱
  for (const cx of [-3.15, -1.55, 0.05]) {
    add(inner, plane(1.4, 0.42, glow({ map: TX.makeDrinkShelf(), intensity: 1.25 })), cx, 2.36, -5.96);
  }

  // アイスクリーム冷凍庫
  {
    const iceB = new Batcher();
    const cx = 1.6,
      cz = -5.7;
    iceB.addBox(1.2, 0.86, 0.7, M.white, cx, STORE.floor + 0.43, cz);
    iceB.addBox(1.06, 0.7, 0.56, glow({ color: 0xcfeaff, intensity: 1.05 }), cx, STORE.floor + 0.5, cz);
    for (let i = 0; i < 10; i++) {
      products.add(
        cx - 0.44 + (i % 5) * 0.22,
        STORE.floor + 0.42,
        cz - 0.16 + Math.floor(i / 5) * 0.3,
        0.18,
        0.1,
        0.24,
        PROD[Math.floor(rnd() * PROD.length)]
      );
    }
    iceB.addBox(1.24, 0.06, 0.74, toon({ color: 0x6fc3e8, rim: 0.2, ramp: RAMP4 }), cx, STORE.floor + 0.9, cz);
    iceB.build(inner, { cast: false });
    add(inner, plane(1.1, 0.34, M.glass), cx, STORE.floor + 0.98, cz, 0, -Math.PI / 2 + 0.35);
  }

  /* ------------------------------ 窓際の什器 ------------------------------ */
  // アイスクリームチェスト
  {
    const x0 = -2.6,
      x1 = -0.9,
      z0 = -1.9,
      z1 = -1.15;
    const cx = (x0 + x1) / 2,
      cz = (z0 + z1) / 2;
    const b = new Batcher();
    b.addBox(x1 - x0, 0.72, 0.06, M.white, cx, STORE.floor + 0.36, z0);
    b.addBox(x1 - x0, 0.72, 0.06, M.white, cx, STORE.floor + 0.36, z1);
    b.addBox(0.06, 0.72, z1 - z0, M.white, x0, STORE.floor + 0.36, cz);
    b.addBox(0.06, 0.72, z1 - z0, M.white, x1, STORE.floor + 0.36, cz);
    b.addBox(x1 - x0 - 0.04, 0.04, z1 - z0 - 0.04, glow({ color: 0xcfeaff, intensity: 1.0 }), cx, STORE.floor + 0.62, cz);
    b.addBox(x1 - x0, 0.08, z1 - z0, toon({ color: 0x6fc3e8, rim: 0.2, ramp: RAMP4 }), cx, STORE.floor + 0.78, cz);
    b.build(inner, { cast: false });
    for (let i = 0; i < 12; i++) {
      products.add(
        x0 + 0.16 + (i % 6) * 0.28,
        STORE.floor + 0.62,
        z0 + 0.22 + Math.floor(i / 6) * 0.32,
        0.22,
        0.1,
        0.24,
        PROD[Math.floor(rnd() * PROD.length)]
      );
    }
    const lid = add(inner, plane(x1 - x0, 0.42, M.glass), cx, STORE.floor + 0.86, cz - 0.16, 0, -Math.PI / 2 + 0.55);
    lid.renderOrder = 2;
    const lid2 = add(inner, plane(x1 - x0, 0.42, M.glass), cx, STORE.floor + 0.86, cz + 0.16, 0, Math.PI / 2 - 0.55);
    lid2.renderOrder = 2;
  }

  // 雑誌ラック
  {
    const cx = -3.4,
      cz = -1.52;
    const b = new Batcher();
    b.addBox(1.1, 0.1, 0.78, M.metalDark, cx, STORE.floor + 0.05, cz);
    b.addBox(1.1, 1.0, 0.08, M.metal, cx, STORE.floor + 0.55, cz - 0.35);
    for (let s = 0; s < 3; s++) {
      b.addBox(1.06, 0.04, 0.62, M.shelf, cx, STORE.floor + 0.42 + s * 0.36, cz + 0.02);
      b.addBox(1.06, 0.03, 0.05, toon({ color: 0xe08a2b, rim: 0.2, ramp: RAMP4 }), cx, STORE.floor + 0.46 + s * 0.36, cz + 0.32);
    }
    b.addBox(1.1, 0.12, 0.08, M.metal, cx, STORE.floor + 1.2, cz + 0.33);
    b.build(inner, { cast: false });
    for (let s = 0; s < 3; s++) {
      let x = cx - 0.5;
      while (x < cx + 0.48) {
        const w = 0.03 + rnd() * 0.03;
        products.add(x, STORE.floor + 0.56 + s * 0.36, cz + 0.02, w, 0.26, 0.2, PROD[Math.floor(rnd() * PROD.length)], 0, -0.22);
        x += w + 0.012;
      }
    }
    add(inner, plane(1.0, 0.2, glow({ map: TX.makeMagazineSpines(), intensity: 0.9 })), cx, STORE.floor + 1.02, cz + 0.33);
  }

  // ATM
  {
    const cx = -0.2,
      cz = -1.65;
    const b = new Batcher();
    b.addBox(0.8, 1.75, 0.6, M.steel, cx, STORE.floor + 0.88, cz);
    b.addBox(0.84, 0.06, 0.64, M.metalDark, cx, STORE.floor + 1.78, cz);
    b.addBox(0.86, 0.34, 0.1, toon({ color: 0x2f7fd8, rim: 0.2, ramp: RAMP4 }), cx, STORE.floor + 1.98, cz - 0.28);
    b.build(inner, { cast: false });
    add(inner, plane(0.44, 0.32, glow({ color: 0x9fd8ff, intensity: 1.1 })), cx, STORE.floor + 1.3, cz + 0.31);
    add(inner, plane(0.6, 0.16, glow({ map: labelTex('ATM', { bg: '#1d63c8', fg: '#ffffff', size: 70 }), intensity: 1.1 })), cx, STORE.floor + 1.98, cz + 0.32);
  }

  // 米袋
  {
    const b = new Batcher();
    for (let i = 0; i < 6; i++) {
      const bx = -3.9 + (i % 2) * 0.4;
      const bz = -2.5 - Math.floor(i / 2) * 0.32;
      b.addRBox(0.34, 0.16, 0.26, toon({ color: i % 3 === 0 ? 0xe8e2d0 : 0xd8cba8, rim: 0.12, ramp: RAMP4 }), bx, STORE.floor + 0.08 + (i % 3) * 0.16, bz, 0.2, 0.03);
    }
    b.build(inner, { cast: false });
  }

  // 買い物かご
  {
    const b = new Batcher();
    for (let i = 0; i < 3; i++) {
      b.addBox(0.36, 0.16, 0.26, toon({ color: i % 2 ? 0xe05a4a : 0x4a90d9, rim: 0.2, ramp: RAMP4 }), -0.75, STORE.floor + 0.1 + i * 0.11, -1.2, 0.15);
    }
    b.build(inner, { cast: false });
  }
  // 店内ゴミ箱
  add(inner, cyl(0.16, 0.14, 0.6, toon({ color: 0x3f4a58, rim: 0.2, ramp: RAMP4 }), 12), -2.45, STORE.floor + 0.3, -1.25);

  /* ------------------------------ レジカウンター ------------------------------ */
  {
    const cx = 3.35,
      cz = -2.1;
    const b = new Batcher();
    b.addBox(1.2, 0.92, 1.0, M.white, cx, STORE.floor + 0.46, cz);
    b.addBox(1.28, 0.06, 1.08, M.metal, cx, STORE.floor + 0.95, cz);
    b.addBox(1.2, 0.06, 0.04, toon({ color: 0x3f8fd0, rim: 0.2, ramp: RAMP4 }), cx, STORE.floor + 0.7, cz + 0.52);
    // レジスター
    b.addBox(0.42, 0.3, 0.36, M.dark, cx + 0.28, STORE.floor + 1.13, cz - 0.15);
    b.addBox(0.34, 0.22, 0.06, M.metalDark, cx + 0.28, STORE.floor + 1.34, cz - 0.28);
    // おでんコーナー
    b.addBox(0.56, 0.22, 0.4, M.steel, cx - 0.3, STORE.floor + 1.09, cz - 0.05);
    for (let i = 0; i < 3; i++) b.addBox(0.02, 0.16, 0.36, M.metal, cx - 0.48 + i * 0.18, STORE.floor + 1.22, cz - 0.05);
    // ホットスナックケース
    b.addBox(0.62, 0.44, 0.3, M.white, cx + 0.2, STORE.floor + 1.17, cz + 0.32);
    b.addBox(0.56, 0.03, 0.24, M.metal, cx + 0.2, STORE.floor + 1.1, cz + 0.32);
    b.addBox(0.56, 0.03, 0.24, M.metal, cx + 0.2, STORE.floor + 1.28, cz + 0.32);
    b.addBox(1.24, 0.05, 0.06, glow({ color: 0xffd9a0, intensity: 1.15 }), cx, STORE.floor + 0.99, cz + 0.5);
    b.build(inner, { cast: false });

    // おでんの温かい光
    const oden = add(inner, plane(0.5, 0.32, glow({ color: 0xfff0c8, intensity: 1.05 })), cx - 0.3, STORE.floor + 1.2, cz - 0.05, 0, -Math.PI / 2);
    out.oden = oden;
    // ホットスナックの中身
    for (let i = 0; i < 6; i++) {
      products.add(cx + 0.02 + (i % 3) * 0.18, STORE.floor + 1.14 + Math.floor(i / 3) * 0.19, cz + 0.32, 0.14, 0.1, 0.14, PROD[(i * 3) % PROD.length]);
    }
    add(inner, plane(0.58, 0.4, M.glass), cx + 0.2, STORE.floor + 1.17, cz + 0.48);

    // 背面カウンター・コーヒーマシン
    const b2 = new Batcher();
    b2.addBox(1.35, 1.3, 0.5, M.white, cx + 0.05, STORE.floor + 0.65, -3.25);
    b2.addBox(1.4, 0.05, 0.56, M.metal, cx + 0.05, STORE.floor + 1.32, -3.25);
    b2.addBox(0.46, 0.62, 0.44, M.dark, cx - 0.3, STORE.floor + 1.65, -3.25);
    b2.addBox(0.4, 0.3, 0.04, glow({ color: 0xffe6b8, intensity: 1.5 }), cx - 0.3, STORE.floor + 1.72, -3.02);
    b2.addBox(0.16, 0.28, 0.2, M.metalDark, cx - 0.3, STORE.floor + 1.42, -3.02);
    // たばこ棚
    for (let r = 0; r < 5; r++) {
      b2.addBox(1.1, 0.03, 0.16, M.metal, cx + 0.05, STORE.floor + 1.5 + r * 0.14, -3.42);
      for (let i = 0; i < 14; i++) {
        products.add(cx - 0.48 + i * 0.072, STORE.floor + 1.55 + r * 0.14, -3.42, 0.06, 0.1, 0.12, PROD[(i * 5 + r) % PROD.length]);
      }
    }
    b2.build(inner, { cast: false });

    // メニュー灯箱
    add(inner, plane(1.3, 0.44, glow({ map: TX.makeMenuBoard(), intensity: 1.15 })), cx + 0.05, 2.24, -3.4);
    // 吊り下げサイン
    add(inner, plane(0.8, 0.22, glow({ map: labelTex('お会計 レジ', { bg: '#c8342f', fg: '#fff6e8', size: 52 }), intensity: 1.1 })), cx, 2.3, -1.72);
    const wire2 = new Batcher();
    wire2.addBox(0.02, 0.3, 0.02, M.metalDark, cx - 0.3, 2.45, -1.72);
    wire2.addBox(0.02, 0.3, 0.02, M.metalDark, cx + 0.3, 2.45, -1.72);
    wire2.build(inner, { cast: false });

    // バックヤード：ロッカー・扉・段ボール
    const b3 = new Batcher();
    b3.addBox(0.3, 1.8, 1.3, toon({ color: 0x9aa3ad, rim: 0.3, ramp: RAMP4 }), 3.92, STORE.floor + 0.9, -4.9);
    for (let i = 0; i < 3; i++) {
      b3.addBox(0.04, 1.6, 0.36, M.metalDark, 3.77, STORE.floor + 0.95, -5.32 + i * 0.42);
      b3.addBox(0.06, 0.05, 0.1, M.metal, 3.74, STORE.floor + 1.2, -5.16 + i * 0.42);
    }
    for (let i = 0; i < 4; i++) {
      b3.addRBox(0.42, 0.3, 0.34, toon({ color: 0xc09a63, rim: 0.12, ramp: RAMP4 }), 2.95 + (i % 2) * 0.45, STORE.floor + 0.15 + Math.floor(i / 2) * 0.31, -5.3, 0.1, 0.02);
    }
    b3.addBox(0.9, 1.7, 0.4, M.metalDark, 3.4, STORE.floor + 0.85, -5.85);
    for (let s = 0; s < 3; s++) {
      b3.addBox(0.86, 0.04, 0.36, M.metal, 3.4, STORE.floor + 0.5 + s * 0.5, -5.85);
      for (let i = 0; i < 5; i++) {
        products.add(3.05 + i * 0.17, STORE.floor + 0.58 + s * 0.5, -5.85, 0.14, 0.14, 0.24, PROD[(i * 3 + s) % PROD.length]);
      }
    }
    b3.build(inner, { cast: false });

    // 裏口（店内側）
    const backDoor = add(inner, plane(0.86, 2.0, toon({ color: 0x8d959e, rim: 0.3, ramp: RAMP4 })), 3.25, STORE.floor + 1.05, -5.94);
    backDoor.renderOrder = 0;
  }

  /* ------------------------------ 店内ポスター ------------------------------ */
  const posterMat0 = glow({ map: TX.makeWindowPoster(0), intensity: 0.72 });
  const posterMat1 = glow({ map: TX.makeWindowPoster(1), intensity: 0.72 });
  const p0 = add(inner, plane(0.66, 0.99, posterMat0), -2.0, 1.55, -0.93);
  const p1 = add(inner, plane(0.6, 0.9, posterMat1), 3.6, 1.5, -0.95);
  p0.renderOrder = 1;
  p1.renderOrder = 1;
  const p2 = add(inner, plane(0.7, 1.05, glow({ map: TX.makeWindowPoster(2), intensity: 0.72 })), -3.9, 1.55, -3.6, Math.PI / 2);
  // 営業中の小さなネオン
  const openSign = add(inner, plane(0.5, 0.18, glow({ map: labelTex('営業中', { bg: '#1d63c8', fg: '#ffffff', size: 62 }), intensity: 1.2 })), 1.2, 2.1, -0.92);
  out.flickers.push({ mat: openSign.material, base: 1.2, amount: 0.18, speed: 1.6, jitter: 4.4 });

  products.build(inner, { cast: false, receive: true });

  /* ------------------------------ 明かりの登録 ------------------------------ */
  out.lightSources.push(
    registerLightSource(new THREE.Vector3(-2.2, 1.5, -0.5), 0xffcf8a, 1.5, 0.55, 0.85),
    registerLightSource(new THREE.Vector3(1.4, 1.5, -0.5), 0xffcf8a, 1.4, 0.5, 0.8),
    registerLightSource(new THREE.Vector3(0, 3.0, -0.6), 0xbfd8ff, 0.9, 0.35, 0.55),
    registerLightSource(new THREE.Vector3(4.05, 3.5, -0.5), 0x8fc4ff, 0.5, 0.3, 0.4)
  );

  return Object.assign(out, { root, materials: M });
}
