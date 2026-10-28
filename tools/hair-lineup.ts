// 发型总表用的样板人物：每种发型配一身合适的衣服与 AI 脸
import type { Look } from '../src/gfx/character';
import type { HairStyle } from '../src/gfx/hair';

const M = (o: Partial<Look>): Look => ({
  sex: 'm', height: 1, build: 1, skin: '#ecd3b4', hair: '#1d1a17', hairStyle: 'bun',
  robe: '#4a5f7a', inner: '#e6dfcf', trim: '#2b3b4b', belt: '#1f2420', pants: '#5a5246', boots: '#2a2622',
  robeLen: 'long', sleeve: 'wide', back: 'none', waist: 'none', hand: 'none', ...o,
});
const F = (o: Partial<Look>): Look => M({
  sex: 'f', height: 0.94, build: 0.9, hairStyle: 'halfup', inner: '#f6f0e8', boots: '#5a4040', robe: '#d4bce0', trim: '#8a6aa0',
  pants: '#a890b8', lip: '#d86a7a', lash: true, ...o,
});

export const SAMPLE_M: Partial<Record<HairStyle, Look>> = {
  crown: M({ face: 'hanli', robe: '#3f6a4c', trim: '#2b4636', ribbon: '#2a3a30', sash: '#1f2420' }),
  bun: M({ face: 'm4', robe: '#7a6a4a', trim: '#4a3e2a' }),
  ponytail: M({ face: 'm2', robe: '#2f3f52', trim: '#1b2733', robeLen: 'short', sleeve: 'narrow', ribbon: '#8a2a2a' }),
  halfup: M({ face: 'm3', robe: '#dcd6c4', trim: '#6a6a60', ribbon: '#5a6a8a' }),
  long: M({ face: 'm6', robe: '#2e2e34', trim: '#6a2a2a', head: 'mo', headColor: '#8a2a2a' }),
  short: M({ face: 'm5', robe: '#8a7a5a', trim: '#5a4a30', robeLen: 'short', sleeve: 'narrow', ribbon: '#3a3a40' }),
  elder: M({ face: 'm7', hair: '#d8d4cc', beard: '#e4e0d8', robe: '#5a2a2a', trim: '#2a1a1a' }),
  bald: M({ face: 'm4', robe: '#c88a3a', trim: '#8a3a2a' }),
};
export const SAMPLE_F: Record<string, Look> & Partial<Record<HairStyle, Look>> = {
  feixian: F({ face: 'f2', robe: '#eef2f8', trim: '#8aa4c8', ribbon: '#9ab8e0', pin: 'jade' }),
  shuanghuan: F({ face: 'f1', robe: '#f0a8bc', trim: '#c05070', ribbon: '#e03050' }),
  chuihuan: F({ face: 'chenqiaoqian', robe: '#b8d4b0', trim: '#5a8a5a', ribbon: '#7aa87a', pin: 'jade' }),
  duoma: F({ face: 'f4', robe: '#8a3a5a', trim: '#4a1a2a', pin: 'flower' }),
  twin: F({ face: 'f3', robe: '#f0c8a8', trim: '#c07050', ribbon: '#e03050', bangs: true }),
  halfup: F({ face: 'f1', robe: '#6aa4b4', trim: '#2a5a6a', ribbon: '#e0e0f0', pin: 'gold' }),
  long: F({ face: 'yuanyao', robe: '#4a3e5e', trim: '#2a2238' }),
  updo: F({ face: 'f5', robe: '#5a2f4a', trim: '#c8a060', pin: 'gold' }),
  liuyun: F({ face: 'ziling', robe: '#8a5ab4', trim: '#4a2a6a', pin: 'gold', ribbon: '#e4ccf4' }),
  braid: F({ face: 'f6', robe: '#a83a3a', trim: '#e0c070', robeLen: 'short', sleeve: 'narrow', ribbon: '#e0c070' }),
  ponytail: F({ face: 'f6', robe: '#3a4a5a', trim: '#c8a050', robeLen: 'short', sleeve: 'narrow', ribbon: '#c03040' }),
};
