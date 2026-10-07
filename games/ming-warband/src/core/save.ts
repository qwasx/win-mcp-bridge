// 存档
import type { GameState } from './state';
import { S, setState, dateStr } from './game';

const KEY = 'ming_warband_save_';
export const SLOTS = ['auto', '1', '2', '3'];
export interface SaveMeta { name: string; level: number; date: string; savedAt: number }

export function saveGame(slot: string) {
  const meta: SaveMeta = { name: S.hero.name, level: S.hero.level, date: dateStr(), savedAt: Date.now() };
  try {
    localStorage.setItem(KEY + slot, JSON.stringify({ meta, state: S }));
    return true;
  } catch { return false; }
}

export function readMeta(slot: string): SaveMeta | null {
  try { const raw = localStorage.getItem(KEY + slot); if (!raw) return null; return JSON.parse(raw).meta; } catch { return null; }
}

export function loadGame(slot: string): boolean {
  try {
    const raw = localStorage.getItem(KEY + slot);
    if (!raw) return false;
    const st = JSON.parse(raw).state as GameState;
    setState(st);
    return true;
  } catch { return false; }
}

export function deleteSave(slot: string) { localStorage.removeItem(KEY + slot); }
export function hasAnySave() { return SLOTS.some(s => readMeta(s)); }
