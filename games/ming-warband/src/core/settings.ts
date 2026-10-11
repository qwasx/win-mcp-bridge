// 游戏设置（与存档无关，保存在浏览器本地）
const KEY = 'ming_warband_settings2';

export interface Settings { fieldCap: number; deploy: boolean }
const DEF: Settings = { fieldCap: 1000, deploy: true };

function load(): Settings {
  try { return { ...DEF, ...(JSON.parse(localStorage.getItem(KEY) || '{}') as Partial<Settings>) }; } catch { return { ...DEF }; }
}
export const settings: Settings = load();
export function saveSettings() { try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* 忽略 */ } }
export const FIELD_CAPS: [number, string][] = [[300, '小（300 人）'], [600, '中（600 人）'], [1000, '大（1000 人）']];
