// 活世界 · 确定性随机数与工具
export function mulberry32(a: number) {
  let t = a >>> 0;
  return function () {
    t += 0x6d2b79f5;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rnd = () => number;

export const ri = (r: Rnd, a: number, b: number) => a + Math.floor(r() * (b - a + 1));
export const rf = (r: Rnd, a: number, b: number) => a + r() * (b - a);
export const pick = <T,>(r: Rnd, a: T[]): T => a[Math.floor(r() * a.length) % a.length];
export const chance = (r: Rnd, p: number) => r() < p;
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const sign = (v: number) => (v > 0 ? 1 : v < 0 ? -1 : 0);

/** 从对象键中稳定取样（遍历顺序由调用方排好序） */
export function weighted<T>(r: Rnd, entries: [T, number][]): T {
  let sum = 0;
  for (const e of entries) sum += Math.max(0, e[1]);
  if (sum <= 0) return entries[0][0];
  let t = r() * sum;
  for (const e of entries) {
    t -= Math.max(0, e[1]);
    if (t <= 0) return e[0];
  }
  return entries[entries.length - 1][0];
}

export function shuffle<T>(r: Rnd, a: T[]): T[] {
  const out = a.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    const t = out[i]; out[i] = out[j]; out[j] = t;
  }
  return out;
}
