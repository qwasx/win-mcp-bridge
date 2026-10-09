// 游戏设置（与存档无关，保存在浏览器本地）
const KEY = 'ming_warband_settings';

export interface Settings { fieldCap: number; deploy: boolean }
const DEF: Settings = { fieldCap: 360, deploy: true };

function load(): Settings {
  try { return { ...DEF, ...(JSON.parse(localStorage.getItem(KEY) || '{}') as Partial<Settings>) }; } catch { return { ...DEF }; }
}
export const settings: Settings = load();
export function saveSettings() { try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* 忽略 */ } }
export const FIELD_CAPS: [number, string][] = [[200, '小（200 人）'], [360, '中（360 人）'], [600, '大（600 人）'], [900, '巨（900 人，需要较好的电脑）']];
