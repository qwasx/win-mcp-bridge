// 主线人物的代码绘制外观（原著形象）
import { withFace, type Look } from '../gfx/character';

const base = (o: Partial<Look>): Look => ({
  sex: 'm', height: 1, build: 1, skin: '#ecd3b4', hair: '#1d1a17', hairStyle: 'bun',
  robe: '#4a4a44', inner: '#e6dfcf', trim: '#2b2b2b', belt: '#1f2420', pants: '#5a5246', boots: '#2a2622',
  robeLen: 'long', sleeve: 'wide', back: 'none', waist: 'none', hand: 'none', ...o,
});

/** 墨大夫（墨居仁）：枯瘦老者，灰袍，花白须，手持药杖 */
export const MO_LOOK = withFace(base({ height: 0.98, build: 0.88, skin: '#dcc3a3', hair: '#9a968c', hairStyle: 'elder', robe: '#4a4a44', trim: '#2e2e2a', inner: '#cfc6b2', beard: '#c8c4ba', hand: 'staff', waist: 'gourd', sash: '#2a2a26' }), 'm7');
/** 厉飞雨：七绝堂少年，劲装短打，背刀，脸色苍白 */
export const LI_LOOK = withFace(base({ height: 1.03, build: 1.02, skin: '#e8d2b8', hair: '#151311', hairStyle: 'ponytail', robe: '#2f3f52', trim: '#1b2733', inner: '#dcd6c8', robeLen: 'short', sleeve: 'narrow', back: 'sword', belt: '#3a2a20', ribbon: '#8a2a2a', swordColor: '#c8d0d8' }), 'm6');
/** 曲魂（张铁之躯）：魁梧，青灰皮肤，破旧黑衣 */
export const QUHUN_LOOK = withFace(base({ height: 1.1, build: 1.28, skin: '#a8aea0', hair: '#2a2a28', hairStyle: 'short', ribbon: '#3a3a36', robe: '#2e2e2c', trim: '#1a1a18', inner: '#5a5a54', robeLen: 'short', sleeve: 'narrow', pants: '#3a3a36', eyeTint: '#7fffb0' }), 'm8');
/** 金光上人：四十余岁干瘦侏儒，杏黄道袍 */
export const JINGUANG_LOOK = withFace(base({ height: 0.8, build: 0.86, skin: '#d8bc98', hair: '#3a3026', hairStyle: 'crown', robe: '#c8a040', trim: '#7a5a20', inner: '#efe2c0', beard: '#3a3026', hand: 'fan', waist: 'pouch' }), 'm4');
/** 贾天龙：野狼帮帮主，膀大腰圆 */
export const JIA_LOOK = withFace(base({ height: 1.06, build: 1.25, skin: '#d4b08a', hair: '#141210', hairStyle: 'short', robe: '#3a2a20', trim: '#7a3020', inner: '#b8a888', robeLen: 'short', sleeve: 'narrow', beard: '#141210', back: 'sword', swordColor: '#b0b0a8' }), 'm8');
/** 欧阳飞天：独霸山庄庄主，暗红锦袍 */
export const OUYANG_LOOK = withFace(base({ height: 1.04, build: 1.1, skin: '#e0c4a2', hair: '#2a2622', hairStyle: 'crown', robe: '#6a2a2a', trim: '#c8a050', inner: '#e8dcc0', beard: '#2a2622', sash: '#c8a050', back: 'sword', swordColor: '#e0e0d8' }), 'm4');
/** 严氏：墨大夫四夫人，精明干练的美妇 */
export const YAN_LOOK = withFace(base({ sex: 'f', height: 0.97, build: 0.92, skin: '#f2dcc6', hair: '#1a1614', hairStyle: 'updo', pin: 'gold', robe: '#5a2f4a', trim: '#c8a060', inner: '#f0e4d4', shawl: '#c89ab0', lash: true, lip: '#b84a50', eyeTint: '#3a2418' }), 'f5');
/** 万小山：憨厚少年 */
export const WAN_LOOK = withFace(base({ height: 0.95, build: 1.05, skin: '#e2c6a2', hair: '#1a1714', hairStyle: 'short', ribbon: '#5a4a32', robe: '#7a6a4a', trim: '#4a3e2a', inner: '#e6dcc4', robeLen: 'short', sleeve: 'narrow', back: 'basket' }), 'm5');
/** 余子童残魂（不用，鬼形） */
