// 法器 / 特殊符箓的代码绘制小图标；其余物品仍用书法字形
import type { CSSProperties } from 'react';
import { itemDef } from '../data/items';
import { ART_LOOK } from '../data/artlooks';
import { artIconURL } from '../gfx/artifact';

export function itemIconURL(id: string, px = 64): string | null {
  const d = itemDef(id);
  if (d.type !== 'artifact' && !ART_LOOK[id]) return null;
  return artIconURL(id, d.art?.kind, undefined, px);
}

/** 有图标就用图，否则退回字形 */
export function ItemGlyph({ id, className, style, px = 64 }: { id: string; className: string; style?: CSSProperties; px?: number }) {
  const u = itemIconURL(id, px), d = itemDef(id);
  if (u) return <img className={className + ' art-ico'} src={u} alt={d.name} draggable={false} />;
  return <span className={className} style={style}>{d.glyph}</span>;
}
