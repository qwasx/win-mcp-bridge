// 把程序化美术注册为 Phaser 纹理（按需生成、缓存）
import Phaser from 'phaser';
import { buildFigureSheet, FRAMES, type FigureSpec, type Weapon } from './figures';
import { buildBanner, buildCart, buildDecoAtlas, buildSettlementAtlas, buildCloud, type Atlas } from './mapArt';
import { heroSpec } from './specs';
import { S } from '../core/game';
import { ITEMS } from '../data/items';
import { FACTION } from '../data/world';

function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}

export interface SheetInfo { key: string; ax: number; ay: number; fw: number; fh: number }
const sheetInfo = new Map<string, SheetInfo>();

export function ensureFigure(scene: Phaser.Scene, spec: FigureSpec, tierFlaps = true): SheetInfo {
  const key = 'fig_' + hash(JSON.stringify(spec) + (tierFlaps ? '1' : '0'));
  const have = sheetInfo.get(key);
  if (have && scene.textures.exists(key)) return have;
  const sh = buildFigureSheet(spec, tierFlaps);
  if (!scene.textures.exists(key)) {
    const tex = scene.textures.addCanvas(key, sh.canvas as HTMLCanvasElement)!;
    for (let i = 0; i < FRAMES; i++) tex.add(i, 0, i * sh.fw, 0, sh.fw, sh.fh);
  }
  const info = { key, ax: sh.ax, ay: sh.ay, fw: sh.fw, fh: sh.fh };
  sheetInfo.set(key, info);
  return info;
}

export function ensureBanner(scene: Phaser.Scene, color: number, ch: string, big = true): SheetInfo {
  const key = `banner_${color.toString(16)}_${ch}_${big ? 1 : 0}`;
  const have = sheetInfo.get(key);
  if (have && scene.textures.exists(key)) return have;
  const b = buildBanner(color, ch, 3, big);
  if (!scene.textures.exists(key)) {
    const tex = scene.textures.addCanvas(key, b.canvas as HTMLCanvasElement)!;
    for (let i = 0; i < 4; i++) tex.add(i, 0, i * b.fw, 0, b.fw, b.fh);
  }
  const info = { key, ax: b.ax, ay: b.ay, fw: b.fw, fh: b.fh };
  sheetInfo.set(key, info);
  return info;
}

export function ensureCart(scene: Phaser.Scene): SheetInfo {
  const key = 'cart';
  const have = sheetInfo.get(key);
  if (have && scene.textures.exists(key)) return have;
  const b = buildCart(3);
  if (!scene.textures.exists(key)) {
    const tex = scene.textures.addCanvas(key, b.canvas as HTMLCanvasElement)!;
    for (let i = 0; i < 4; i++) tex.add(i, 0, i * b.fw, 0, b.fw, b.fh);
  }
  const info = { key, ax: b.ax, ay: b.ay, fw: b.fw, fh: b.fh };
  sheetInfo.set(key, info);
  return info;
}

const atlasFrames = new Map<string, Map<string, { ax: number; ay: number; w: number; h: number }>>();
export function ensureAtlas(scene: Phaser.Scene, key: string, build: () => Atlas) {
  if (scene.textures.exists(key) && atlasFrames.has(key)) return atlasFrames.get(key)!;
  const a = build();
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.addCanvas(key, a.canvas as HTMLCanvasElement)!;
  const m = new Map<string, { ax: number; ay: number; w: number; h: number }>();
  for (const f of a.frames) { tex.add(f.name, 0, f.x, f.y, f.w, f.h); m.set(f.name, { ax: f.ax, ay: f.ay, w: f.w, h: f.h }); }
  atlasFrames.set(key, m);
  return m;
}
export const decoAtlas = (scene: Phaser.Scene) => ensureAtlas(scene, 'deco', buildDecoAtlas);
export const settlementAtlas = (scene: Phaser.Scene) => ensureAtlas(scene, 'setts', buildSettlementAtlas);

export function ensureClouds(scene: Phaser.Scene) {
  for (let i = 0; i < 3; i++) if (!scene.textures.exists('cloud' + i)) scene.textures.addCanvas('cloud' + i, buildCloud(11 + i * 7) as HTMLCanvasElement);
}

/** 主角外观 */
export function heroWeapon(mode: 'melee' | 'ranged' = 'melee'): Weapon {
  const h = S.hero;
  if (mode === 'ranged' && h.equip.ranged) { const k = ITEMS[h.equip.ranged]?.kind; return k === 'gun' ? 'gun' : k === 'xbow' ? 'xbow' : 'bow'; }
  const m = h.equip.melee ? ITEMS[h.equip.melee] : null;
  if (!m) return 'club';
  if (m.id === 'w_jian') return 'club';
  if (m.id === 'w_miaodao') return 'katana';
  if (m.antiCav || (m.reach ?? 0) >= 40) return 'spear';
  return 'sabre';
}
export function heroArmorLevel() {
  const a = S.hero.equip.armor ? ITEMS[S.hero.equip.armor] : null;
  const t = a?.tier ?? 0;
  return t <= 1 ? 1 : t <= 3 ? 2 : 3;
}
export function heroColor() {
  const f = S.playerFaction ? FACTION[S.playerFaction] : null;
  return f && S.playerFaction !== 'player' ? f.color : 0xd4af37;
}
export function currentHeroSpec(mounted: boolean, mode: 'melee' | 'ranged' = 'melee') {
  return heroSpec({ mounted, weapon: heroWeapon(mode), armor: heroArmorLevel(), color: heroColor() });
}

export const FACTION_CHAR: Record<string, string> = { ming: '明', jin: '金', chuang: '闯', xi: '西', mon: '蒙', bandit: '寇', none: '' };
