// 脸 / 头 / 身材参数：缺省值、按种子生成（千人千面）、解析缓存、编辑器滑杆元数据
import type { Look, Sex, FaceParams, HeadParams, BodyParams, EyeShape, BrowShape, Fringe, Collar, SkirtKind, OverKind, IdleStyle } from './types';

export function hashStr(s: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export const EYE_NAMES: Record<EyeShape, string> = { phoenix: '丹凤眼', almond: '杏眼', peach: '桃花眼', round: '圆眼', narrow: '细长眼', droopy: '垂眼' };
export const BROW_NAMES: Record<BrowShape, string> = { sword: '剑眉', willow: '柳叶眉', distant: '远山眉', thick: '浓眉', arched: '弯眉', flat: '平眉' };
export const FRINGE_NAMES: Record<Fringe, string> = { none: '无刘海', full: '齐刘海', side: '斜刘海', part: '中分', wisp: '鬓边碎发' };

const EYES_M: EyeShape[] = ['narrow', 'phoenix', 'almond', 'narrow', 'droopy', 'almond', 'phoenix', 'round'];
const EYES_F: EyeShape[] = ['almond', 'peach', 'phoenix', 'round', 'almond', 'peach', 'droopy', 'phoenix'];
const BROWS_M: BrowShape[] = ['sword', 'sword', 'thick', 'flat', 'arched', 'sword', 'flat'];
const BROWS_F: BrowShape[] = ['willow', 'distant', 'arched', 'willow', 'flat', 'distant'];
const IRIS = ['#4a3426', '#3a2a1e', '#5a3c28', '#2e2018', '#4a3a30', '#6a4632', '#3c3024'];

export function defaultFace(sex: Sex): FaceParams {
  return sex === 'f'
    ? { eye: 'almond', eyeSize: 1.12, eyeGap: 1, eyeTilt: 0.15, brow: 'willow', browW: 0.9, browH: 0, nose: 0.92, mouth: 0.9, lip: 1.05, smile: 0.15, blush: 0.55, age: 0, mole: 0, iris: '#5a3a2a' }
    : { eye: 'narrow', eyeSize: 0.96, eyeGap: 1, eyeTilt: 0.1, brow: 'sword', browW: 1.05, browH: 0, nose: 1.02, mouth: 1, lip: 0.9, smile: 0, blush: 0.12, age: 0, mole: 0, iris: '#3a2a1e' };
}
export function defaultHead(sex: Sex): HeadParams {
  return sex === 'f' ? { size: 1, width: 0.95, jaw: 0.12, chin: 1.0, cheek: 0.3, neck: 1.05 } : { size: 1, width: 1, jaw: 0.5, chin: 1.03, cheek: 0.15, neck: 1 };
}
export function defaultBody(sex: Sex): BodyParams {
  return sex === 'f'
    ? { shoulder: 1, chest: 1, waist: 1, hip: 1, leg: 1.03, arm: 1, heft: 1, belly: 0, stoop: 0 }
    : { shoulder: 1, chest: 1, waist: 1, hip: 1, leg: 1, arm: 1, heft: 1, belly: 0, stoop: 0 };
}

/** 千人千面：同一种子永远生成同一张脸 */
export function genFace(seed: number, sex: Sex, age = 0): FaceParams {
  const r = rng(seed ^ 0x5f3759df), f = sex === 'f';
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const g = () => (r() + r() + r()) / 3 - 0.5; // 近似正态 ±0.5
  return {
    eye: pick(f ? EYES_F : EYES_M),
    eyeSize: clamp((f ? 1.12 : 0.97) + g() * 0.26, 0.86, 1.25),
    eyeGap: clamp(1 + g() * 0.22, 0.86, 1.14),
    eyeTilt: clamp((f ? 0.15 : 0.08) + g() * 0.9, -0.7, 0.8),
    brow: pick(f ? BROWS_F : BROWS_M),
    browW: clamp((f ? 0.9 : 1.08) + g() * 0.5, 0.6, 1.5),
    browH: clamp(g() * 0.5, -0.35, 0.35),
    nose: clamp((f ? 0.93 : 1.03) + g() * 0.3, 0.82, 1.2),
    mouth: clamp((f ? 0.9 : 1) + g() * 0.3, 0.8, 1.2),
    lip: clamp((f ? 1.05 : 0.9) + g() * 0.6, 0.6, 1.4),
    smile: clamp(g() * 1.1 + (f ? 0.12 : 0), -0.6, 0.7),
    blush: clamp((f ? 0.55 : 0.1) + g() * 0.4, 0, 1),
    age: clamp(age, 0, 1),
    mole: r() < 0.08 ? 1 : r() < 0.05 ? 2 : 0,
    iris: pick(IRIS),
  };
}
export function genHead(seed: number, sex: Sex): HeadParams {
  const r = rng(seed ^ 0x2545f491), f = sex === 'f';
  const g = () => (r() + r()) / 2 - 0.5;
  return {
    size: clamp(1 + g() * 0.1, 0.94, 1.06),
    width: clamp((f ? 0.95 : 1) + g() * 0.12, 0.88, 1.08),
    jaw: clamp((f ? 0.14 : 0.5) + g() * 0.5, 0, 1),
    chin: clamp((f ? 1 : 1.03) + g() * 0.1, 0.92, 1.1),
    cheek: clamp((f ? 0.3 : 0.15) + g() * 0.5, 0, 1),
    neck: clamp((f ? 1.05 : 1) + g() * 0.14, 0.88, 1.15),
  };
}
export function genBody(seed: number, sex: Sex): BodyParams {
  const r = rng(seed ^ 0x68e31da4), f = sex === 'f';
  const g = () => (r() + r()) / 2 - 0.5;
  return {
    shoulder: clamp(1 + g() * 0.14, 0.9, 1.12),
    chest: clamp(1 + g() * 0.3, 0.85, 1.2),
    waist: clamp(1 + g() * 0.2, 0.88, 1.15),
    hip: clamp(1 + g() * 0.18, 0.9, 1.12),
    leg: clamp((f ? 1.03 : 1) + g() * 0.08, 0.95, 1.08),
    arm: 1, heft: clamp(1 + g() * 0.12, 0.92, 1.1), belly: 0, stoop: 0,
  };
}

/** 解析后的完整参数（每个 Look 对象缓存一次） */
export interface RLook {
  fem: boolean; face: FaceParams; head: HeadParams; body: BodyParams;
  fringe: Fringe; collar: Collar; skirt: SkirtKind; over: OverKind; idle: IdleStyle;
  old: number;       // 0–1 老态
  skirtColor: string; overColor: string; cuff: string;
  sleeveK: number;   // 广袖垂幅
}
const cache = new WeakMap<Look, RLook>();

function lum(hex: string) {
  const h = hex.replace('#', '');
  if (h.length < 6) return 0.2;
  const n = parseInt(h.slice(0, 6), 16);
  return (((n >> 16) & 255) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11) / 255;
}

export function lookSeed(look: Look) {
  return look.faceSeed ?? hashStr(`${look.sex}|${look.skin}|${look.hair}|${look.hairStyle}|${look.robe}|${look.beard ?? ''}|${look.height.toFixed(4)}|${look.build.toFixed(4)}`);
}

export function resolveLook(look: Look): RLook {
  let r = cache.get(look);
  if (r) return r;
  const fem = look.sex === 'f';
  const seed = lookSeed(look);
  const old = Math.max(lum(look.hair) > 0.55 ? 0.85 : 0, look.beard && lum(look.beard) > 0.55 ? 1 : look.beard ? 0.35 : 0);
  // 显式给了参数的按显式；只给了部分则以“性别默认”补齐（主角、红颜要稳定），否则按种子生成
  const face = look.face ? { ...defaultFace(look.sex), ...look.face } : genFace(seed, look.sex, old);
  if (look.eyeTint) face.iris = look.eyeTint;
  face.age = Math.max(face.age, old);
  const head = look.head ? { ...defaultHead(look.sex), ...look.head } : genHead(seed, look.sex);
  const body = look.body ? { ...defaultBody(look.sex), ...look.body } : genBody(seed, look.sex);
  if (old > 0.5 && !look.body) body.stoop = Math.max(body.stoop, 0.35 * old);
  const fringe: Fringe = look.fringe ?? (look.bangs ? 'full' : fem ? (look.hairStyle === 'long' || look.hairStyle === 'halfup' ? 'part' : 'wisp') : 'none');
  const short = look.robeLen === 'short';
  const skirt: SkirtKind = look.skirt ?? (short ? 'pants' : fem ? 'pleat' : 'robe');
  const over: OverKind = look.over ?? 'none';
  const idle: IdleStyle = look.idle ?? (fem ? (seed % 3 === 0 ? 'chest' : 'clasp') : look.hero ? 'behind' : old > 0.5 ? 'behind' : seed % 4 === 0 ? 'behind' : 'stand');
  r = {
    fem, face, head, body, fringe, collar: look.collar ?? 'cross', skirt, over, idle, old,
    skirtColor: look.skirtColor ?? look.robe,
    overColor: look.overColor ?? (over === 'armor' ? '#4a4c52' : over === 'kasaya' ? '#a8452e' : over === 'cape' ? '#2a2a30' : look.trim),
    cuff: look.cuff ?? '#3a2c22',
    sleeveK: look.sleeve === 'wide' ? (fem ? 1.18 : 1) : 0,
  };
  cache.set(look, r);
  return r;
}

// ---------------------------------------------------------------- 编辑器滑杆元数据（换衣 / 捏脸面板共用）
export interface Slider<K extends string> { key: K; name: string; min: number; max: number; step: number }
export const FACE_SLIDERS: Slider<keyof FaceParams>[] = [
  { key: 'eyeSize', name: '眼睛大小', min: 0.8, max: 1.25, step: 0.01 },
  { key: 'eyeGap', name: '眼距', min: 0.85, max: 1.15, step: 0.01 },
  { key: 'eyeTilt', name: '眼尾上挑', min: -0.8, max: 0.9, step: 0.01 },
  { key: 'browW', name: '眉粗', min: 0.6, max: 1.5, step: 0.01 },
  { key: 'browH', name: '眉高', min: -0.4, max: 0.4, step: 0.01 },
  { key: 'nose', name: '鼻', min: 0.8, max: 1.2, step: 0.01 },
  { key: 'mouth', name: '嘴宽', min: 0.8, max: 1.2, step: 0.01 },
  { key: 'lip', name: '唇厚', min: 0.6, max: 1.4, step: 0.01 },
  { key: 'smile', name: '嘴角', min: -1, max: 1, step: 0.01 },
  { key: 'blush', name: '腮红', min: 0, max: 1, step: 0.01 },
  { key: 'age', name: '年纪', min: 0, max: 1, step: 0.01 },
];
export const HEAD_SLIDERS: Slider<keyof HeadParams>[] = [
  { key: 'size', name: '头大小', min: 0.9, max: 1.12, step: 0.01 },
  { key: 'width', name: '脸宽', min: 0.88, max: 1.1, step: 0.01 },
  { key: 'jaw', name: '下颌（瓜子→国字）', min: 0, max: 1, step: 0.01 },
  { key: 'chin', name: '下巴', min: 0.9, max: 1.12, step: 0.01 },
  { key: 'cheek', name: '脸颊丰盈', min: 0, max: 1, step: 0.01 },
  { key: 'neck', name: '颈长', min: 0.85, max: 1.2, step: 0.01 },
];
export const BODY_SLIDERS: Slider<keyof BodyParams>[] = [
  { key: 'shoulder', name: '肩宽', min: 0.85, max: 1.2, step: 0.01 },
  { key: 'chest', name: '胸', min: 0.8, max: 1.3, step: 0.01 },
  { key: 'waist', name: '腰', min: 0.8, max: 1.3, step: 0.01 },
  { key: 'hip', name: '臀', min: 0.85, max: 1.25, step: 0.01 },
  { key: 'leg', name: '腿长', min: 0.92, max: 1.1, step: 0.01 },
  { key: 'heft', name: '壮硕', min: 0.85, max: 1.35, step: 0.01 },
  { key: 'belly', name: '肚腩', min: 0, max: 1, step: 0.01 },
  { key: 'stoop', name: '驼背', min: 0, max: 1, step: 0.01 },
];
