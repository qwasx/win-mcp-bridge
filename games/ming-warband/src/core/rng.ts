// 随机数与噪声工具
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const rand = Math.random;
export function randInt(a: number, b: number) { return a + Math.floor(Math.random() * (b - a + 1)); }
export function randRange(a: number, b: number) { return a + Math.random() * (b - a); }
export function pick<T>(arr: readonly T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
export function chance(p: number) { return Math.random() < p; }
export function clamp(v: number, a: number, b: number) { return v < a ? a : v > b ? b : v; }
export function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}
export function weighted<T>(items: [T, number][]): T {
  let total = 0; for (const [, w] of items) total += w;
  let r = Math.random() * total;
  for (const [it, w] of items) { r -= w; if (r <= 0) return it; }
  return items[items.length - 1][0];
}

function hash2(x: number, y: number, seed: number) {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function smooth(t: number) { return t * t * (3 - 2 * t); }
export function valueNoise(x: number, y: number, seed: number) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  const u = smooth(xf), v = smooth(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x: number, y: number, seed: number, oct = 4) {
  let s = 0, amp = 0.5, f = 1, norm = 0;
  for (let i = 0; i < oct; i++) { s += valueNoise(x * f, y * f, seed + i * 17) * amp; norm += amp; amp *= 0.5; f *= 2; }
  return s / norm;
}

export function dist(ax: number, ay: number, bx: number, by: number) { return Math.hypot(ax - bx, ay - by); }
