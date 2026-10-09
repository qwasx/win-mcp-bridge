// 天气：随季节、地域与时间确定性变化（同一时间同一地点总是相同的天气，存档读档不会跳变）
import { toLL } from './terrain';
import { dayOf } from './game';

export type WeatherKind = 'clear' | 'rain' | 'snow';
export interface Weather { kind: WeatherKind; k: number; storm: boolean }

export const SEASON_NAME = ['春', '夏', '秋', '冬'];
/** 0 春 1 夏 2 秋 3 冬（按农历月份） */
export function seasonOf(t: number) {
  const m = Math.floor((dayOf(t) % 36) / 3); // 0 = 正月
  if (m <= 2) return 0; if (m <= 5) return 1; if (m <= 8) return 2; return 3;
}
function monthOf(t: number) { return Math.floor((dayOf(t) % 36) / 3); }

function hash(a: number, b: number, c: number) {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = (h ^ (h >>> 13)) * 1274126177; h = h ^ (h >>> 16);
  return ((h >>> 0) % 100000) / 100000;
}

function blockWeather(b: number, x: number, y: number): Weather {
  const t = b * 6;
  const m = monthOf(t);
  const lat = toLL(x, y)[1], lon = toLL(x, y)[0];
  const cx = Math.floor(x / 700), cy = Math.floor(y / 700);
  // 连续几块共享一个“天气系统”，避免忽晴忽雨
  const sys = hash(Math.floor(b / 3), cx, cy);
  const winter = m >= 10 || m <= 1;
  const summer = m >= 4 && m <= 6;
  let chance = lat < 27 ? 0.3 : lat < 32 ? 0.26 : lat < 37 ? 0.16 : 0.1;
  if (summer) chance *= lat < 34 ? 1.5 : 1.3;          // 梅雨、夏汛
  if (winter && lat < 30) chance *= 0.8;
  if (lon < 106 && lat > 35) chance *= 0.35;           // 西北干旱
  if (lat > 41 && winter) chance *= 1.2;               // 关外雪多
  if (sys >= chance) return { kind: 'clear', k: 0, storm: false };
  const k = 0.35 + 0.65 * (1 - sys / chance) * (0.7 + 0.3 * hash(b, cx + 7, cy));
  const snow = winter && (lat > 31 || (m === 11 || m === 0) && lat > 28);
  return { kind: snow ? 'snow' : 'rain', k: Math.min(1, k), storm: !snow && summer && k > 0.8 };
}

export function weatherAt(x: number, y: number, t: number): Weather {
  const b = Math.floor(t / 6), f = (t / 6) - b;
  const w0 = blockWeather(b, x, y), w1 = blockWeather(b + 1, x, y);
  const ff = Math.max(0, Math.min(1, (f - 0.6) / 0.4));
  const s = ff * ff * (3 - 2 * ff);
  const e0 = w0.k * (1 - s), e1 = w1.k * s;
  if (w0.kind === w1.kind) return { kind: w0.kind, k: e0 + e1, storm: (w0.storm && s < 0.5) || (w1.storm && s >= 0.5) };
  return e0 >= e1 ? { kind: w0.kind, k: e0, storm: w0.storm } : { kind: w1.kind, k: e1, storm: w1.storm };
}

export function weatherName(w: Weather) {
  if (w.kind === 'clear' || w.k < 0.08) return '晴';
  if (w.kind === 'snow') return w.k > 0.7 ? '大雪' : w.k > 0.35 ? '中雪' : '小雪';
  if (w.storm) return '雷雨';
  return w.k > 0.7 ? '大雨' : w.k > 0.35 ? '中雨' : '小雨';
}

/** 季节积雪程度 0..1（腊月、正月最厚） */
export function winterK(t: number) {
  const SN = [1, 0.6, 0.08, 0, 0, 0, 0, 0, 0, 0, 0.3, 0.8];
  const md = ((dayOf(t) % 36) + (t % 24) / 24) / 3;
  const m0 = Math.floor(md) % 12, mf = md - Math.floor(md);
  return SN[m0] + (SN[(m0 + 1) % 12] - SN[m0]) * mf;
}
/** 某地地面积雪 0..1 */
export function snowCover(x: number, y: number, t: number) {
  const lat = toLL(x, y)[1];
  const base = Math.max(0, Math.min(1, (lat - 31.5) / 6)) * winterK(t);
  const w = weatherAt(x, y, t);
  return Math.min(1, base + (w.kind === 'snow' ? w.k * 0.6 : 0));
}
