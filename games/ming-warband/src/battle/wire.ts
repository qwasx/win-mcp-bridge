// 联机实时战斗的二进制帧：写入（服务器）与读取（客户端）
// 帧格式（小端）：
//   u8 类型=1 | u32 tick | u32 战斗时间(ms) | u16 单位数 | 单位… | u16 事件数 | 事件…
//   单位：u16 uid | u8 mask | [mask&1: u16 x*4, u16 y*4] [mask&2: i8 dx, i8 dy（1/4 像素）] [mask&4: u8 朝向] [mask&8: u8 血量] [mask&16: u8 状态位]
//   事件 1（射击）：u8 种类|骑射<<4 | u16 射手 | u16 x*2 | u16 y*2 | u16 角度 | u16 距离 | u16 射程
//   事件 2（命中）：u16 目标 | u16 攻击者 | u8 伤害 | u8 种类
export class Writer {
  buf: Uint8Array; dv: DataView; pos = 0;
  constructor(n = 4096) { this.buf = new Uint8Array(n); this.dv = new DataView(this.buf.buffer); }
  reset() { this.pos = 0; }
  need(n: number) {
    if (this.pos + n <= this.buf.length) return;
    let m = this.buf.length * 2; while (m < this.pos + n) m *= 2;
    const b = new Uint8Array(m); b.set(this.buf); this.buf = b; this.dv = new DataView(b.buffer);
  }
  u8(v: number) { this.need(1); this.buf[this.pos++] = v & 255; }
  i8(v: number) { this.need(1); this.dv.setInt8(this.pos++, v); }
  u16(v: number) { this.need(2); this.dv.setUint16(this.pos, v & 0xffff, true); this.pos += 2; }
  setU16(at: number, v: number) { this.dv.setUint16(at, v & 0xffff, true); }
  u32(v: number) { this.need(4); this.dv.setUint32(this.pos, v >>> 0, true); this.pos += 4; }
  /** 拷贝出本帧（可安全转交给 worker/socket） */
  bytes() { return this.buf.slice(0, this.pos); }
}

export interface UnitDelta { uid: number; mask: number; x: number; y: number; dx: number; dy: number; face: number; hp: number; st: number }
export interface ShotEv { k: 1; kind: number; mounted: boolean; from: number; x: number; y: number; a: number; dist: number; range: number }
export interface HitEv { k: 2; to: number; from: number; dmg: number; kind: number }
export interface Frame { tick: number; t: number; units: UnitDelta[]; evs: (ShotEv | HitEv)[] }

export function readFrame(ab: ArrayBuffer | Uint8Array): Frame | null {
  const u8 = ab instanceof Uint8Array ? ab : new Uint8Array(ab);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  let p = 0;
  if (u8.length < 11 || u8[0] !== 1) return null;
  p = 1;
  const tick = dv.getUint32(p, true); p += 4;
  const t = dv.getUint32(p, true); p += 4;
  const n = dv.getUint16(p, true); p += 2;
  const units: UnitDelta[] = [];
  for (let i = 0; i < n; i++) {
    const uid = dv.getUint16(p, true); p += 2;
    const mask = u8[p++];
    const d: UnitDelta = { uid, mask, x: 0, y: 0, dx: 0, dy: 0, face: 0, hp: 0, st: 0 };
    if (mask & 1) { d.x = dv.getUint16(p, true) / 4; d.y = dv.getUint16(p + 2, true) / 4; p += 4; }
    else if (mask & 2) { d.dx = dv.getInt8(p) / 4; d.dy = dv.getInt8(p + 1) / 4; p += 2; }
    if (mask & 4) d.face = u8[p++] / 256 * Math.PI * 2;
    if (mask & 8) d.hp = u8[p++] / 255;
    if (mask & 16) d.st = u8[p++];
    units.push(d);
  }
  const evs: (ShotEv | HitEv)[] = [];
  const ne = dv.getUint16(p, true); p += 2;
  for (let i = 0; i < ne; i++) {
    const k = u8[p++];
    if (k === 1) {
      const km = u8[p++];
      const from = dv.getUint16(p, true), x = dv.getUint16(p + 2, true) / 2, y = dv.getUint16(p + 4, true) / 2;
      const a = dv.getUint16(p + 6, true) / 65535 * Math.PI * 2, dist = dv.getUint16(p + 8, true), range = dv.getUint16(p + 10, true);
      p += 12;
      evs.push({ k: 1, kind: km & 15, mounted: !!(km >> 4), from, x, y, a, dist, range });
    } else if (k === 2) {
      const to = dv.getUint16(p, true), from = dv.getUint16(p + 2, true), dmg = u8[p + 4], kind = u8[p + 5];
      p += 6;
      evs.push({ k: 2, to, from, dmg, kind });
    } else break;
  }
  return { tick, t, units, evs };
}
