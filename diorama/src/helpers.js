import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import * as BGU from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const LAYER_SOLID = 0;
export const LAYER_FX = 1;

/* ---------------------------------- 基本 ---------------------------------- */
export function xform(x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ'));
  m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx, sy, sz));
  return m;
}

export function place(obj, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0) {
  obj.position.set(x, y, z);
  obj.rotation.set(rx, ry, rz);
  return obj;
}

export function add(parent, obj, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0) {
  if (x !== undefined) place(obj, x, y, z, ry, rx, rz);
  parent.add(obj);
  return obj;
}

export function boxGeo(w, h, d) {
  return new THREE.BoxGeometry(w, h, d);
}
export function rboxGeo(w, h, d, r = 0.02, s = 1) {
  const rr = Math.min(r, Math.min(w, h, d) * 0.49);
  return new RoundedBoxGeometry(w, h, d, s, rr);
}
export function cylGeo(rt, rb, h, seg = 12, open = false) {
  return new THREE.CylinderGeometry(rt, rb, h, seg, 1, open);
}
export function planeGeo(w, h) {
  return new THREE.PlaneGeometry(w, h);
}

export function box(w, h, d, mat) {
  return new THREE.Mesh(boxGeo(w, h, d), mat);
}
export function rbox(w, h, d, mat, r = 0.02, s = 1) {
  return new THREE.Mesh(rboxGeo(w, h, d, r, s), mat);
}
export function cyl(rt, rb, h, mat, seg = 12) {
  return new THREE.Mesh(cylGeo(rt, rb, h, seg), mat);
}
export function plane(w, h, mat) {
  return new THREE.Mesh(planeGeo(w, h), mat);
}
export function sphere(r, mat, seg = 12) {
  return new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(6, seg / 2)), mat);
}

export function fx(obj) {
  obj.traverse((o) => o.layers.set(LAYER_FX));
  return obj;
}
export function shadow(obj, cast = true, receive = true) {
  obj.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = cast;
      o.receiveShadow = receive;
    }
  });
  return obj;
}

/* ------------------------------------------------------------------ *
 *  地面用：ワールド座標から UV を焼いた平面
 * ------------------------------------------------------------------ */
export function groundQuad(x1, z1, x2, z2, y, mat) {
  const w = Math.abs(x2 - x1);
  const d = Math.abs(z2 - z1);
  const geo = new THREE.PlaneGeometry(w, d, 1, 1);
  geo.rotateX(-Math.PI / 2);
  geo.translate((x1 + x2) / 2, y, (z1 + z2) / 2);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (pos.getX(i) + 8) / 16, (pos.getZ(i) + 8) / 16);
  }
  uv.needsUpdate = true;
  const m = new THREE.Mesh(geo, mat);
  m.receiveShadow = true;
  return m;
}

/* ------------------------------------------------------------------ *
 *  同素材の小物をまとめるバッチャ（ドローコール削減）
 * ------------------------------------------------------------------ */
export class Batcher {
  constructor() {
    this.groups = new Map();
  }
  add(geo, mat, matrix = null) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (matrix) g.applyMatrix4(matrix);
    let arr = this.groups.get(mat);
    if (!arr) {
      arr = [];
      this.groups.set(mat, arr);
    }
    arr.push(g);
    return this;
  }
  addBox(w, h, d, mat, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0) {
    return this.add(boxGeo(w, h, d), mat, xform(x, y, z, ry, rx, rz));
  }
  addCyl(rt, rb, h, mat, seg, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0) {
    return this.add(cylGeo(rt, rb, h, seg), mat, xform(x, y, z, ry, rx, rz));
  }
  addRBox(w, h, d, mat, x = 0, y = 0, z = 0, ry = 0, r = 0.02, s = 1) {
    return this.add(rboxGeo(w, h, d, r, s), mat, xform(x, y, z, ry));
  }
  build(parent, { cast = true, receive = true } = {}) {
    const out = [];
    for (const [mat, arr] of this.groups) {
      if (!arr.length) continue;
      const merged = arr.length === 1 ? arr[0] : BGU.mergeGeometries(arr, false);
      if (!merged) continue;
      const m = new THREE.Mesh(merged, mat);
      m.castShadow = cast;
      m.receiveShadow = receive;
      parent.add(m);
      out.push(m);
    }
    this.groups.clear();
    return out;
  }
}

/* ------------------------------------------------------------------ *
 *  商品のインスタンス描画（棚・冷蔵庫の中身）
 * ------------------------------------------------------------------ */
export class ProductBatch {
  constructor(material) {
    this.mat = material;
    this.items = [];
  }
  add(x, y, z, w, h, d, color, ry = 0, rz = 0) {
    this.items.push({ x, y, z, w, h, d, color, ry, rz });
    return this;
  }
  build(parent, { cast = true, receive = true } = {}) {
    if (!this.items.length) return null;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const im = new THREE.InstancedMesh(geo, this.mat, this.items.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const v = new THREE.Vector3();
    const s = new THREE.Vector3();
    const col = new THREE.Color();
    this.items.forEach((it, i) => {
      e.set(0, it.ry, it.rz, 'YXZ');
      q.setFromEuler(e);
      v.set(it.x, it.y, it.z);
      s.set(it.w, it.h, it.d);
      m.compose(v, q, s);
      im.setMatrixAt(i, m);
      col.set(it.color);
      im.setColorAt(i, col);
    });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.castShadow = cast;
    im.receiveShadow = receive;
    im.frustumCulled = false;
    parent.add(im);
    return im;
  }
}

/* ------------------------------------------------------------------ *
 *  電線（たるみ付き）
 * ------------------------------------------------------------------ */
export function wire(from, to, sag, radius, mat, seg = 28) {
  const a = new THREE.Vector3().fromArray(from);
  const b = new THREE.Vector3().fromArray(to);
  const pts = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    const p = new THREE.Vector3().lerpVectors(a, b, t);
    p.y -= Math.sin(Math.PI * t) * sag;
    pts.push(p);
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const geo = new THREE.TubeGeometry(curve, seg, radius, 4, false);
  const m = new THREE.Mesh(geo, mat);
  return m;
}

export function rand(min, max) {
  return min + Math.random() * (max - min);
}
export function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
