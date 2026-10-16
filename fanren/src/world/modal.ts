// 通用对话 / 交易 / 城镇面板的数据结构（第四步起，NPC、红颜、奇遇、大事件共用）
import type { Look } from '../gfx/character';
import type { LocDef } from '../data/world';

export interface DOpt {
  label: string;
  hint?: string;
  disabled?: boolean;
  tone?: 'good' | 'bad' | 'love' | 'gold';
  /** 返回下一段对话；返回 null / undefined 则关闭 */
  act?: () => DNode | null | void;
}
export interface DNode {
  speaker: string;
  title?: string;           // 称谓、境界
  portrait?: string;        // 立绘（仅红颜）
  look?: Look;              // 无立绘时，用代码绘制的半身像
  text: string;
  options: DOpt[];
  mood?: 'love' | 'danger' | 'mystic' | 'normal';
}

export interface ShopStock { id: string; price: number; n: number; age?: number }
export interface Shop {
  title: string; desc?: string;
  stock: ShopStock[];
  sellRate: number;                 // 卖出价格比例
  currency?: 'lingshi' | 'contrib'; // 灵石 / 宗门贡献
  noSell?: boolean;
}

export type Modal =
  | { kind: 'dialog'; node: DNode }
  | { kind: 'shop'; shop: Shop }
  | { kind: 'town'; loc: LocDef; fac?: string }
  | { kind: 'auction'; loc: LocDef }
  | { kind: 'sect' }
  | { kind: 'hearts' }
  | { kind: 'chronicle' }
  | { kind: 'help' };
