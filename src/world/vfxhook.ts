import { SECT_FX } from '../data/sectfx';
// 第 6 阶段：特效库的「世界侧」接口（不依赖 WebGL，逻辑代码可放心引用）
//  · 施法打标：Combat 施法前后各调一次，把这次新生的弹道 / 光效 / 区域 / 天降打击都标上法术 id，渲染时按配方绘制。
//  · 大型特效请求：bigfx(kind, opts)——天劫雷、灵气漩涡、光柱、水墨冲击波、法相……渲染层（gl/bigfx.ts）每帧取走。
//    突破、天劫、剧情演出都可直接调用，接口说明见 docs/stage-notes/s6-vfx.md。

/** 大型特效种类 */
export type BigFxKind =
  | 'tribulation'   // 天劫雷：头顶劫云漩涡，数道粗雷连劈落点
  | 'vortex'        // 灵气漩涡：地面螺旋，灵光向心收拢（突破吸纳灵气）
  | 'pillar'        // 光柱冲天：底部光环 + 冲天光柱 + 上升光点
  | 'inkshock'      // 水墨冲击波：三重飞白墨环向外荡开 + 墨点飞溅
  | 'dharma'        // 法相：身后显化巨大金身（可跟随）
  | 'swordArray'    // 剑阵阵图：周天星斗阵纹 + 剑幕光帘（大庚剑阵叠层）
  | 'lotus'         // 金莲：脚下一朵巨大莲台缓缓绽开
  | 'heavenSeal';   // 天雷法印：空中篆印压下 + 金色光柱（辟邪神雷等）

export interface BigFxOpts {
  x: number; y: number;
  r?: number;          // 规模（世界单位，默认按种类）
  dur?: number;        // 持续秒数（默认按种类）
  color?: string;      // 主色 "r,g,b"（默认按种类）
  color2?: string;     // 副色
  follow?: () => { x: number; y: number } | null;   // 跟随目标（返回 null 视为结束）
  power?: number;      // 强度 0.5–3（影响劈雷数、粒子数）
}
export interface BigFxReq extends BigFxOpts { kind: BigFxKind }

/** 待渲染层取走的请求（渲染层每帧清空；无 WebGL 时最多积压 16 条） */
export const BIGFX_Q: BigFxReq[] = [];
export function bigfx(kind: BigFxKind, opts: BigFxOpts) {
  if (!Number.isFinite(opts.x + opts.y)) return;
  if (BIGFX_Q.length >= 16) BIGFX_Q.shift();
  BIGFX_Q.push({ kind, ...opts });
}
if (typeof window !== 'undefined') (window as any).__bigfx = bigfx;

/** NPC 宗门修士的招式主色：本门色系主色（不认识的宗门用五行原色） */
export function sectCol(sect: string | undefined, fallback: string): string { return (sect && SECT_FX[sect]?.pal[1]) || fallback; }

interface Taggable { vfx: any[]; fields: any[]; strikes: any[]; projs: any[]; acts?: { list: any[] }; buffs?: any; game?: any }
/** 施法前：记下各列表长度 */
export function vfxMark(c: Taggable): number[] { return [c.vfx.length, c.fields.length, c.strikes.length, c.projs.length, c.acts?.list.length ?? 0]; }
/** 施法后：给新生的特效对象标上法术 id（已有 skill 的不覆盖） */
export function vfxTag(c: Taggable, m: number[], skill: string) {
  const tag = (a: any[], i0: number) => { for (let i = i0; i < a.length; i++) if (a[i] && !a[i].skill) a[i].skill = skill; };
  tag(c.vfx, m[0]); tag(c.fields, m[1]); tag(c.strikes, m[2]); tag(c.projs, m[3]);
  // 大庚剑阵：在剑阵中心叠一层阵图大场面
  if (skill === 'dageng' && c.acts) for (let i = m[4]; i < c.acts.list.length; i++) {
    const a = c.acts.list[i]; if (a && Number.isFinite(a.cx) && Number.isFinite(a.R)) bigfx('swordArray', { x: a.cx, y: a.cy, r: a.R, dur: 6, follow: () => (a.done ? null : { x: a.cx, y: a.cy }) });
  }
  // 法相金身：增益期间身后显化金身；明王诀：脚下金莲
  const g = c.game, b = c.buffs;
  if (g?.player && b?.until && (skill === 'faxiang' || skill === 'mingwang')) {
    const p = g.player, live = () => ((b.until.def ?? 0) > g.time || (b.until.atk ?? 0) > g.time);
    if (skill === 'faxiang') bigfx('dharma', { x: p.x, y: p.y, r: 1, dur: 60, follow: () => (live() ? { x: p.x, y: p.y } : null) });
    else bigfx('lotus', { x: p.x, y: p.y, r: 120, dur: 3.2, color: '255,190,80', follow: () => ({ x: p.x, y: p.y }) });
  }
}
