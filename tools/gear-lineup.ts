// 装扮样板：同一套男 / 女框架，换衣服、头饰、铠甲、挂件
import type { Look } from '../src/gfx/character';

const M = (o: Partial<Look>): Look => ({
  sex: 'm', height: 1, build: 1, skin: '#ecd3b4', hair: '#1d1a17', hairStyle: 'bun',
  robe: '#4a4a44', inner: '#e6dfcf', trim: '#2b2b2b', belt: '#1f2420', pants: '#5a5246', boots: '#2a2622',
  robeLen: 'long', sleeve: 'wide', back: 'none', waist: 'none', hand: 'none', ...o,
});
const F = (o: Partial<Look>): Look => M({ sex: 'f', height: 0.94, build: 0.9, hairStyle: 'halfup', inner: '#f6f0e8', boots: '#5a4040', ...o });

export const OUTFITS: [string, Look][] = [
  ['将军（明光铠）', M({ face: 'm2', robe: '#7a2a24', trim: '#c8a040', inner: '#e8d8b0', robeLen: 'short', sleeve: 'narrow', armor: '#c9a54e', cape: '#9a2a22', head: 'guan', headColor: '#d8b050', waist: 'token', belt: '#3a2618', pants: '#5a3a2a', back: 'sword' })],
  ['守卫（铁札甲）', M({ face: 'm8', robe: '#3a4a5a', trim: '#8a6a3a', robeLen: 'short', sleeve: 'narrow', armor: '#8c949c', head: 'jin', headColor: '#2a2a30', hairStyle: 'bun', pants: '#3a3a36', build: 1.1 })],
  ['道士（莲花冠）', M({ face: 'm4', robe: '#c8a050', trim: '#6a4a20', inner: '#efe2c0', head: 'lotus', headColor: '#d8b860', waist: 'peijade', sash: '#6a4a20', beard: undefined })],
  ['书生（幅巾）', M({ face: 'm3', robe: '#dcd6c4', trim: '#6a6a60', head: 'jin', headColor: '#3a4a5a', hand: 'fan', waist: 'jade' })],
  ['剑修（发冠）', M({ face: 'hanli', robe: '#3f6a4c', trim: '#2b4636', ribbon: '#2a3a30', hairStyle: 'crown', waist: 'pouch', back: 'sword', sash: '#1f2420' })],
  ['女将（银甲）', F({ face: 'f6', robe: '#a83a3a', trim: '#e0c070', robeLen: 'short', sleeve: 'narrow', armor: '#c8ccd2', cape: '#e8e4dc', head: 'mo', headColor: '#a02828', hairStyle: 'ponytail', pants: '#6a3030' })],
  ['仙子（帷帽）', F({ face: 'f2', robe: '#eef2f8', trim: '#8aa4c8', inner: '#ffffff', shawl: '#d4e4f4', head: 'veil', waist: 'peijade', hairStyle: 'long' })],
  ['女修（步摇）', F({ face: 'f1', robe: '#d4bce0', trim: '#8a6aa0', hairStyle: 'updo', pin: 'gold', shawl: '#e4ccf4', waist: 'jade', lip: '#d86a7a' })],
];
