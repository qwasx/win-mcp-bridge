import * as THREE from 'three';
import { toon, glow, neon, RAMP3, RAMP4, registerLightSource } from './materials.js';
import { Batcher, box, plane, cyl, sphere, add, place, wire, fx } from './helpers.js';
import * as TX from './textures.js';

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

export function buildProps(scene) {
  const root = new THREE.Group();
  root.name = 'props';
  scene.add(root);

  const out = { flickers: [], lights: [], sources: [] };

  const M = {
    metal: toon({ color: 0x9aa2ab, rim: 0.42, rimColor: 0xc2d6f2, ramp: RAMP4 }),
    metalDark: toon({ color: 0x4b5158, rim: 0.3, rimColor: 0x9fb6d8, ramp: RAMP4 }),
    dark: toon({ color: 0x24282f, rim: 0.22, ramp: RAMP3 }),
    darker: toon({ color: 0x16191f, rim: 0.18, ramp: RAMP3 }),
    white: toon({ color: 0xf2f2ef, rim: 0.16, ramp: RAMP4 }),
    poleGrey: toon({ color: 0x6e747c, rim: 0.28, ramp: RAMP4 }),
    concrete: toon({ map: TX.makeConcreteTexture(), rim: 0.12, ramp: RAMP4 }),
    red: toon({ color: 0xc0392b, rim: 0.28, ramp: RAMP4 }),
    orange: toon({ color: 0xe07b2a, rim: 0.3, ramp: RAMP4 }),
    green: toon({ color: 0x3f7a4e, rim: 0.22, ramp: RAMP4 }),
    blue: toon({ color: 0x2f6fb5, rim: 0.28, ramp: RAMP4 }),
    wireMat: toon({ color: 0x12151a, rim: 0.12, ramp: RAMP3 }),
    silver: toon({ color: 0xb9bfc6, rim: 0.5, rimColor: 0xdce8f8, ramp: RAMP4 }),
  };

  /* ============================ 自動販売機 ============================ */
  const vendingB = new Batcher();
  for (const [i, vx] of [3.12, 3.98].entries()) {
    const vz = 0.52;
    vendingB.addBox(0.85, 1.9, 0.75, M.dark, vx, 1.09, vz);
    vendingB.addBox(0.88, 0.08, 0.78, M.metalDark, vx, 2.08, vz);
    vendingB.addBox(0.88, 0.1, 0.78, M.metalDark, vx, 0.19, vz);
    vendingB.addBox(0.06, 1.72, 0.04, glow({ color: 0x8fd8ff, intensity: 1.0 }), vx - 0.42, 1.06, vz + 0.38);
    vendingB.addBox(0.06, 1.72, 0.04, glow({ color: 0xffd08f, intensity: 0.95 }), vx + 0.42, 1.06, vz + 0.38);
    const vtx = TX.makeVendingFront(i);
    const vmat = neon({ map: vtx, emissive: 0xffffff, emissiveMap: vtx, emissiveIntensity: 0.55, color: 0xaaaaaa });
    add(root, plane(0.78, 1.62, vmat), vx, 1.12, vz + 0.38);
    out.flickers.push({ mat: vmat, base: 0.55, amount: 0.07, speed: 7.0 + i * 3, jitter: i * 2.2 });
    // 取り出し口
    vendingB.addBox(0.5, 0.28, 0.06, M.darker, vx - 0.14, 0.42, vz + 0.38);
    vendingB.addBox(0.12, 0.5, 0.05, M.metalDark, vx + 0.36, 1.2, vz + 0.38);
  }
  vendingB.build(root);
  out.sources.push(registerLightSource(new THREE.Vector3(3.55, 1.3, 0.7), 0x9fd8ff, 0.85, 0.4, 0.9));

  // 氷の箱
  {
    const b = new Batcher();
    b.addBox(0.52, 0.55, 0.42, M.blue, 2.52, 0.42, 0.55);
    b.addBox(0.54, 0.06, 0.44, M.white, 2.52, 0.72, 0.55);
    b.build(root);
    add(root, plane(0.34, 0.18, glow({ map: labelTex('氷', { bg: '#ffffff', fg: '#2f6fb5', size: 76 }), intensity: 0.9 })), 2.52, 0.5, 0.77);
  }

  /* ============================ 自転車 ============================ */
  {
    const bike = new THREE.Group();
    const frame = toon({ color: 0x2f3d52, rim: 0.35, rimColor: 0xa8c4ee, ramp: RAMP4 });
    const tire = toon({ color: 0x1b1e24, rim: 0.2, ramp: RAMP3 });
    const b = new Batcher();
    for (const wx of [-0.52, 0.52]) {
      b.addCyl(0.31, 0.31, 0.05, tire, 16, wx, 0.31, 0, 0, 0, Math.PI / 2);
      b.addCyl(0.05, 0.05, 0.06, M.silver, 8, wx, 0.31, 0, 0, 0, Math.PI / 2);
      for (let s = 0; s < 8; s++) {
        const a = (s / 8) * Math.PI * 2;
        b.addBox(0.012, 0.58, 0.012, M.silver, wx, 0.31, 0, Math.PI / 2, a);
      }
    }
    // フレーム
    b.addCyl(0.026, 0.026, 0.98, frame, 6, 0.0, 0.42, 0, 0, 0, Math.PI / 2 - 0.12);
    b.addCyl(0.026, 0.026, 0.62, frame, 6, -0.2, 0.62, 0, 0, 0, Math.PI / 2 - 0.9);
    b.addCyl(0.026, 0.026, 0.66, frame, 6, 0.16, 0.6, 0, 0, 0, Math.PI / 2 + 1.1);
    b.addCyl(0.024, 0.024, 0.5, frame, 6, -0.5, 0.62, 0, 0, 0, Math.PI / 2 - 0.6);
    b.addCyl(0.024, 0.024, 0.44, frame, 6, 0.52, 0.66, 0, 0, 0, Math.PI / 2 - 1.2);
    // ハンドル・サドル・カゴ
    b.addCyl(0.024, 0.024, 0.56, M.silver, 6, 0.44, 0.98, 0, 0, Math.PI / 2);
    b.addBox(0.09, 0.34, 0.09, M.dark, 0.5, 0.86, 0);
    b.addBox(0.3, 0.06, 0.14, M.dark, -0.16, 0.78, 0);
    b.addBox(0.34, 0.22, 0.3, toon({ color: 0xc9a06a, rim: 0.2, ramp: RAMP4 }), 0.62, 0.78, 0);
    b.addCyl(0.02, 0.02, 0.3, M.silver, 6, -0.36, 0.2, 0.08);
    b.build(bike);
    bike.rotation.z = 0.055;
    add(root, bike, -3.6, 0.14, 0.6, 0.18);
  }

  /* ============================ 傘立て ============================ */
  {
    const b = new Batcher();
    b.addBox(0.32, 0.62, 0.32, M.metalDark, -2.85, 0.45, -0.4);
    b.addBox(0.36, 0.05, 0.36, M.metal, -2.85, 0.78, -0.4);
    b.addCyl(0.035, 0.035, 0.55, toon({ color: 0x2f4a6b, rim: 0.3, ramp: RAMP4 }), 8, -2.92, 0.95, -0.42, 0, 0.12, 0.1);
    b.addCyl(0.035, 0.035, 0.52, toon({ color: 0x6b3f4a, rim: 0.3, ramp: RAMP4 }), 8, -2.78, 0.92, -0.36, 0, -0.1, -0.14);
    b.build(root);
  }

  /* ============================ ごみ箱 ============================ */
  {
    const b = new Batcher();
    b.addCyl(0.24, 0.2, 0.9, toon({ map: TX.makeGarbageTexture(), color: 0xffffff, rim: 0.22, ramp: RAMP4 }), 14, -3.05, 0.59, 0.62);
    b.addCyl(0.26, 0.26, 0.06, M.dark, 14, -3.05, 1.07, 0.62);
    b.addBox(0.3, 0.05, 0.3, M.dark, -3.05, 1.11, 0.62);
    b.addCyl(0.2, 0.17, 0.72, M.blue, 12, -2.45, 0.5, 0.62);
    b.addCyl(0.22, 0.22, 0.05, M.dark, 12, -2.45, 0.89, 0.62);
    b.build(root);
  }

  /* ============================ ドアマット・立て看板 ============================ */
  {
    const mat = add(root, box(2.2, 0.03, 1.0, toon({ map: TX.makeDoorMatTexture(), rim: 0.08, ramp: RAMP4 })), -1.8, 0.155, -0.42);
    mat.receiveShadow = true;
    const afTex = TX.makeAFrameSign();
    const a1 = add(root, plane(0.62, 0.92, toon({ map: afTex, rim: 0.16, ramp: RAMP4 })), 1.15, 0.6, 0.24, 0, -0.2);
    const a2 = add(root, plane(0.62, 0.92, toon({ map: afTex, rim: 0.16, ramp: RAMP4 })), 1.15, 0.6, 0.52, Math.PI, 0.2);
  }

  /* ============================ 電柱・電線 ============================ */
  const polePos = {
    p1: new THREE.Vector3(-6.3, 0, 0.2),
    p2: new THREE.Vector3(4.95, 0, 0.75),
    p3: new THREE.Vector3(-6.3, 0, -7.4),
  };
  const poleB = new Batcher();
  const pole = (p, h, arms) => {
    poleB.addCyl(0.13, 0.17, h, M.poleGrey, 10, p.x, h / 2, p.z);
    for (let i = 0; i < arms; i++) {
      const y = h - 0.35 - i * 0.55;
      poleB.addBox(1.5, 0.07, 0.09, M.metalDark, p.x, y, p.z);
      poleB.addBox(0.07, 0.07, 0.07, M.metalDark, p.x - 0.6, y + 0.14, p.z);
      poleB.addBox(0.07, 0.07, 0.07, M.metalDark, p.x + 0.6, y + 0.14, p.z);
      for (const ix of [-0.55, -0.2, 0.2, 0.55]) {
        poleB.addCyl(0.035, 0.035, 0.16, M.white, 6, p.x + ix, y + 0.11, p.z);
      }
    }
  };
  pole(polePos.p1, 8.2, 3);
  pole(polePos.p2, 7.4, 2);
  pole(polePos.p3, 7.8, 2);
  // 変圧器
  poleB.addCyl(0.26, 0.26, 0.78, M.metalDark, 12, polePos.p1.x + 0.32, 6.2, polePos.p1.z);
  poleB.addBox(0.12, 0.3, 0.12, M.metalDark, polePos.p1.x + 0.32, 6.72, polePos.p1.z);
  // 柱の表示
  poleB.addBox(0.16, 0.5, 0.03, M.white, polePos.p1.x, 1.6, polePos.p1.z + 0.15);
  poleB.build(root);

  const wires = new THREE.Group();
  root.add(wires);
  const wm = M.wireMat;
  const addWire = (a, b, sag, r = 0.022) => {
    wires.add(wire([a.x, a.y, a.z], [b.x, b.y, b.z], sag, r, wm));
  };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  for (let i = 0; i < 3; i++) {
    addWire(V(-6.9 - i * 0.05, 7.85 - i * 0.55, 0.2), V(4.35 - i * 0.05, 7.05 - i * 0.55, 0.75), 1.1 + i * 0.12);
  }
  for (let i = 0; i < 2; i++) {
    addWire(V(-6.9 - i * 0.4, 7.3 - i * 0.55, 0.2), V(-6.9 - i * 0.4, 7.1 - i * 0.55, -7.4), 0.55);
  }
  addWire(V(5.5, 7.05, 0.75), V(8.15, 6.75, 0.9), 0.55);
  addWire(V(5.5, 6.5, 0.75), V(8.15, 6.25, 1.05), 0.45);
  // 建物への引き込み線
  addWire(V(5.3, 6.4, 0.8), V(4.1, 4.0, -0.85), 0.42, 0.018);
  addWire(V(-6.8, 5.4, 0.2), V(-6.6, 4.6, 0.4), 0.25, 0.018);
  addWire(V(-6.75, 4.4, -7.2), V(-5.6, 3.2, -7.6), 0.3, 0.016);

  /* ============================ 街路灯 ============================ */
  const lampB = new Batcher();
  const mkLamp = (x, z, h, armLen, armDir) => {
    lampB.addCyl(0.07, 0.1, h, M.poleGrey, 10, x, h / 2, z);
    lampB.addBox(armLen, 0.08, 0.08, M.poleGrey, x + (armDir[0] * armLen) / 2, h - 0.05, z + (armDir[2] * armLen) / 2);
    const hx = x + armDir[0] * armLen;
    const hz = z + armDir[2] * armLen;
    lampB.addBox(0.52, 0.14, 0.3, M.metalDark, hx, h - 0.16, hz);
    lampB.addBox(0.44, 0.05, 0.24, glow({ color: 0xffe2ad, intensity: 1.5 }), hx, h - 0.24, hz);
    return new THREE.Vector3(hx, h - 0.26, hz);
  };
  const lampA = mkLamp(-4.85, 0.85, 4.6, 1.05, [0, 0, 1]);
  const lampBpos = mkLamp(4.95, 0.75, 7.4, 1.1, [0.35, 0, 0.94]);
  const lampC = mkLamp(7.35, -3.6, 3.6, 0.7, [0, 0, 1]);
  lampB.build(root);

  out.sources.push(
    registerLightSource(lampA, 0xffd79a, 1.05, 0.75, 1.15),
    registerLightSource(lampBpos, 0xffd79a, 1.15, 0.8, 1.1),
    registerLightSource(lampC, 0xffcf90, 0.9, 0.7, 0.75)
  );
  out.lampPositions = [lampA, lampBpos, lampC];

  /* ============================ 信号機 ============================ */
  const tl = { mats: {}, pos: new THREE.Vector3(3.2, 4.75, 6.0) };
  {
    const b = new Batcher();
    b.addCyl(0.09, 0.12, 5.2, M.poleGrey, 10, 3.2, 2.6, 7.4);
    b.addBox(0.1, 0.1, 1.5, M.poleGrey, 3.2, 5.02, 6.7);
    b.addBox(0.34, 0.86, 0.28, M.dark, 3.2, 4.75, 6.02);
    b.addBox(0.44, 0.1, 0.34, M.dark, 3.2, 5.24, 6.02);
    b.build(root);
    const cols = {
      red: glow({ color: 0xff3b30, intensity: 0.12 }),
      yellow: glow({ color: 0xffc21e, intensity: 0.1 }),
      green: glow({ color: 0x39d96a, intensity: 2.2 }),
    };
    let i = 0;
    for (const k of ['red', 'yellow', 'green']) {
      const d = add(root, cyl(0.085, 0.085, 0.04, cols[k], 14), 3.2, 5.0 - i * 0.26, 5.87, 0, Math.PI / 2);
      d.renderOrder = 1;
      tl.mats[k] = cols[k];
      i++;
    }
    // 信号の反射用光源
    tl.source = registerLightSource(tl.pos, 0x39d96a, 0.8, 0.55, 0.5);
    out.trafficLight = tl;
  }

  /* ============================ ガードレール ============================ */
  {
    const b = new Batcher();
    const rail = (x0, z0, x1, z1) => {
      const dx = x1 - x0;
      const dz = z1 - z0;
      const len = Math.hypot(dx, dz);
      const ang = Math.atan2(dx, dz);
      const n = Math.max(2, Math.round(len / 1.3));
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        b.addCyl(0.045, 0.045, 0.95, M.silver, 8, x0 + dx * t, 0.48, z0 + dz * t);
      }
      for (const y of [0.9, 0.5]) {
        b.addBox(0.06, 0.11, len, M.silver, (x0 + x1) / 2, y, (z0 + z1) / 2, ang);
      }
      b.addBox(0.09, 0.09, len, M.silver, (x0 + x1) / 2, 0.95, (z0 + z1) / 2, ang);
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        b.addBox(0.1, 0.06, 0.16, toon({ color: 0xf5f7fa, rim: 0.5, rimColor: 0xffffff, ramp: RAMP3 }), x0 + dx * t, 0.9, z0 + dz * t, ang);
      }
    };
    rail(-5.3, 0.92, -2.6, 0.92);
    rail(-5.15, 0.92, -5.15, -3.4);
    b.build(root);
  }

  /* ============================ 標識・ポスト ============================ */
  {
    const b = new Batcher();
    // 路牌（電柱に取り付け）
    b.addBox(0.5, 0.05, 0.05, M.metalDark, -6.05, 3.5, 0.35);
    b.addBox(0.5, 0.05, 0.05, M.metalDark, -5.85, 3.9, 0.35);
    // 駐車場の案内
    b.addCyl(0.045, 0.045, 2.2, M.poleGrey, 8, 5.4, 1.1, -4.3);
    b.addBox(0.06, 0.5, 0.06, M.poleGrey, 5.4, 2.4, -4.3);
    // ポスト
    b.addCyl(0.045, 0.045, 0.9, M.poleGrey, 8, -4.8, 0.45, -1.6);
    b.addBox(0.5, 0.75, 0.4, M.red, -4.8, 1.28, -1.6);
    b.addBox(0.52, 0.06, 0.42, M.dark, -4.8, 1.68, -1.6);
    b.addBox(0.3, 0.06, 0.03, M.dark, -4.8, 1.5, -1.4);
    // トライコーン
    b.addBox(0.4, 0.04, 0.4, M.orange, 5.5, 0.02, -0.45);
    b.addCyl(0.05, 0.17, 0.5, M.orange, 10, 5.5, 0.27, -0.45);
    b.addCyl(0.115, 0.135, 0.1, M.white, 10, 5.5, 0.33, -0.45);
    // 配電盤
    b.addBox(0.55, 0.85, 0.3, toon({ color: 0x9fa6ad, rim: 0.3, ramp: RAMP4 }), 4.75, 0.57, -0.35);
    b.addBox(0.57, 0.06, 0.32, M.metalDark, 4.75, 1.02, -0.35);
    b.build(root);

    add(root, plane(1.0, 0.5, glow({ map: TX.makeStreetSign(), intensity: 0.85 })), -5.9, 3.62, 0.38);
    add(root, plane(0.5, 0.5, glow({ map: labelTex('P 駐車場', { w: 256, h: 256, bg: '#1d5fa8', fg: '#ffffff', size: 54 }), intensity: 0.95 })), 5.4, 2.3, -4.05);
    add(root, plane(0.44, 0.14, glow({ map: labelTex('〒 ポスト', { bg: '#c0392b', fg: '#ffffff', size: 60 }), intensity: 0.9 })), -4.8, 1.62, -1.39);
  }

  /* ============================ 建物A（路地の向かい） ============================ */
  {
    const b = new Batcher();
    const x0 = -8,
      x1 = -6.6,
      z0 = -8,
      z1 = 1.0;
    b.addBox(x1 - x0, 7.6, z1 - z0, toon({ color: 0x3d4149, rim: 0.16, ramp: RAMP4 }), (x0 + x1) / 2, 3.8, (z0 + z1) / 2);
    b.addBox(x1 - x0 + 0.1, 0.18, z1 - z0 + 0.1, M.dark, (x0 + x1) / 2, 7.68, (z0 + z1) / 2);
    // 雨樋
    b.addCyl(0.05, 0.05, 7.6, M.metalDark, 8, -6.63, 3.8, 0.6);
    // 室外機
    b.addBox(0.7, 0.55, 0.28, M.metal, -6.42, 4.4, -3.0);
    b.addBox(0.1, 0.06, 0.4, M.metalDark, -6.6, 4.12, -3.0);
    // 壁灯
    b.addBox(0.12, 0.12, 0.2, M.metalDark, -6.56, 2.75, -1.5);
    b.addBox(0.16, 0.06, 0.26, glow({ color: 0xffdfae, intensity: 1.2 }), -6.6, 2.66, -1.5);
    // メーター類
    for (let i = 0; i < 3; i++) b.addBox(0.06, 0.22, 0.3, M.metalDark, -6.62, 1.5 + i * 0.3, -5.4);
    b.build(root);

    // 路地側のファサード
    const facA = add(root, plane(9.0, 7.6, toon({ map: TX.makeBuildingFacade(3, 3, 0.28), rim: 0.1, ramp: RAMP4 })), -6.58, 3.8, -3.5, Math.PI / 2);
    facA.material.map.repeat.set(2, 1);
    facA.material.map.wrapS = facA.material.map.wrapT = THREE.RepeatWrapping;

    // 表通り側：シャッターの店
    const shopB = new Batcher();
    shopB.addBox(1.3, 2.6, 0.12, toon({ color: 0x7b828c, rim: 0.22, ramp: RAMP4 }), -7.3, 1.3, 1.04);
    for (let i = 0; i < 14; i++) shopB.addBox(1.32, 0.03, 0.14, M.metalDark, -7.3, 0.2 + i * 0.19, 1.05);
    shopB.addBox(1.4, 0.12, 0.5, M.dark, -7.3, 2.72, 1.25);
    shopB.addBox(0.06, 0.5, 0.06, M.metalDark, -7.9, 2.45, 1.25);
    shopB.addBox(0.06, 0.5, 0.06, M.metalDark, -6.7, 2.45, 1.25);
    shopB.addBox(1.44, 0.22, 0.72, toon({ color: 0x2f4a6b, rim: 0.2, ramp: RAMP4 }), -7.3, 2.86, 1.32);
    shopB.build(root);
    add(root, plane(1.2, 0.34, glow({ map: labelTex('クリーニング', { bg: '#1d5fa8', fg: '#ffffff', size: 52 }), intensity: 0.95 })), -7.3, 2.75, 1.32);
    out.sources.push(registerLightSource(new THREE.Vector3(-6.6, 2.7, -1.5), 0xffcf90, 0.55, 0.45, 0.45));
  }

  /* ============================ 建物B（駐車場の奥） ============================ */
  {
    const b = new Batcher();
    const cx = 6.6,
      cz = -6.3;
    b.addBox(2.8, 6.4, 3.4, toon({ color: 0x464a52, rim: 0.16, ramp: RAMP4 }), cx, 3.2, cz);
    b.addBox(2.9, 0.16, 3.5, M.dark, cx, 6.48, cz);
    // バルコニー
    for (const fy of [2.3, 4.4]) {
      b.addBox(2.4, 0.1, 0.9, toon({ color: 0x6d727a, rim: 0.2, ramp: RAMP4 }), cx, fy, -4.75);
      for (let i = 0; i < 9; i++) b.addBox(0.04, 0.42, 0.04, M.metalDark, cx - 1.1 + i * 0.275, fy + 0.26, -4.32);
      b.addBox(2.4, 0.05, 0.06, M.metalDark, cx, fy + 0.48, -4.32);
      b.addBox(0.5, 0.3, 0.4, toon({ color: 0x8a9098, rim: 0.2, ramp: RAMP4 }), cx - 0.7, fy + 0.5, -4.9);
    }
    // 室外機
    b.addBox(0.62, 0.5, 0.26, M.metal, 7.6, 2.6, -4.72);
    b.addCyl(0.05, 0.05, 6.4, M.metalDark, 8, 5.42, 3.2, -4.62);
    // 壁灯
    b.addBox(0.14, 0.14, 0.22, M.metalDark, 6.1, 3.4, -4.7);
    b.addBox(0.18, 0.06, 0.28, glow({ color: 0xffdfae, intensity: 1.1 }), 6.05, 3.3, -4.7);
    b.build(root);

    const facB = add(root, plane(2.8, 6.4, toon({ map: TX.makeBuildingFacade(9, 3, 0.45), rim: 0.1, ramp: RAMP4 })), cx, 3.2, -4.58);
    facB.material.map.repeat.set(1, 2);
    facB.material.map.wrapS = facB.material.map.wrapT = THREE.RepeatWrapping;
    out.sources.push(registerLightSource(new THREE.Vector3(6.05, 3.3, -4.6), 0xffcf90, 0.5, 0.4, 0.35));
  }

  /* ============================ 裏のブロック塺 ============================ */
  {
    const b = new Batcher();
    b.addBox(11.8, 1.8, 0.22, M.concrete, -0.7, 0.9, -8.05);
    b.addBox(11.9, 0.08, 0.3, M.dark, -0.7, 1.84, -8.05);
    // 植え込み
    for (let x = -6.2; x < 5.0; x += 0.7) {
      b.addRBox(0.55, 0.35, 0.5, toon({ color: 0x24361f, rim: 0.14, ramp: RAMP4 }), x, 2.0, -8.05, 0, 0.12, 1);
    }
    // 裏通りの電灯
    b.addCyl(0.05, 0.05, 2.4, M.poleGrey, 8, 1.6, 1.2, -7.85);
    b.addBox(0.3, 0.1, 0.42, M.metalDark, 1.6, 2.4, -7.85);
    b.addBox(0.24, 0.05, 0.34, glow({ color: 0xffdfae, intensity: 1.15 }), 1.6, 2.33, -7.85);
    b.build(root);
    out.sources.push(registerLightSource(new THREE.Vector3(1.6, 2.3, -7.8), 0xffcf90, 0.7, 0.5, 0.5));
  }

  /* ============================ 裏口まわりの小物 ============================ */
  {
    const b = new Batcher();
    // パレットと段ボール
    b.addBox(1.2, 0.12, 0.9, toon({ color: 0xa8874f, rim: 0.14, ramp: RAMP4 }), 0.4, 0.06, -7.3);
    for (let i = 0; i < 5; i++)
      b.addRBox(0.4, 0.28, 0.34, toon({ color: 0xc09a63, rim: 0.12, ramp: RAMP4 }), 0.05 + (i % 3) * 0.42, 0.26 + Math.floor(i / 3) * 0.3, -7.25 - (i % 2) * 0.3, 0.12, 0.02);
    // ゴミ集積所
    for (const gx of [-2.7, -2.0, -1.3]) {
      b.addCyl(0.28, 0.24, 1.0, toon({ color: gx === -2.0 ? 0x3f6fa8 : 0x3f7a4e, rim: 0.2, ramp: RAMP4 }), 12, gx, 0.5, -7.55);
      b.addCyl(0.3, 0.3, 0.06, M.dark, 12, gx, 1.03, -7.55);
    }
    // 自転車置き場の屋根
    b.addBox(2.6, 0.08, 1.4, M.metalDark, -4.6, 2.3, -7.3);
    for (const px of [-5.7, -3.5]) {
      b.addCyl(0.05, 0.05, 2.3, M.metalDark, 8, px, 1.15, -7.85);
      b.addCyl(0.05, 0.05, 2.3, M.metalDark, 8, px, 1.15, -6.75);
    }
    b.build(root);
    // ごみ袋（路地側）
    const bagB = new Batcher();
    for (let i = 0; i < 3; i++) {
      bagB.addRBox(0.28, 0.4, 0.28, toon({ color: i % 2 ? 0x2c2f36 : 0x3d4250, rim: 0.14, ramp: RAMP4 }), -4.75 + i * 0.3, 0.2, -5.6 + (i % 2) * 0.25, 0.4, 0.12, 1);
    }
    bagB.build(root);
  }

  /* ============================ 植え込み（駐車場） ============================ */
  {
    const b = new Batcher();
    for (const px of [5.62, 6.35]) {
      b.addBox(0.5, 0.35, 0.5, toon({ color: 0x6b5b48, rim: 0.14, ramp: RAMP4 }), px, 0.175, -4.25);
      b.addRBox(0.46, 0.5, 0.46, toon({ color: 0x27402a, rim: 0.16, ramp: RAMP4 }), px, 0.55, -4.25, 0.3, 0.16, 1);
    }
    b.build(root);
  }

  return out;
}
