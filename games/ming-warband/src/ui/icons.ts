// 手绘线描图标：取代系统 emoji（各平台显示不一），统一为墨线风格，颜色随文字
const P: Record<string, string> = {
  // 双刀交叉
  swords: '<path d="M4 3l10.5 10.5M3.5 3.2l.4 2.6 2.3-.3M20 3L9.5 13.5M20.5 3.2l-.4 2.6-2.3-.3"/><path d="M12.5 15.5l-3-3M11.5 15.5l3-3"/><path d="M6.5 15.5l-3 3 2 2 3-3M17.5 15.5l3 3-2 2-3-3"/>',
  // 掷筹（骰）
  dice: '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="8.5" cy="8.5" r="1.1" class="f"/><circle cx="15.5" cy="15.5" r="1.1" class="f"/><circle cx="12" cy="12" r="1.1" class="f"/>',
  // 城楼
  fort: '<path d="M2.5 9.5c3-.6 6-2.5 9.5-5 3.5 2.5 6.5 4.4 9.5 5"/><path d="M5 9v3h14V9"/><path d="M3.5 14c3-.4 5.5-1.4 8.5-3 3 1.6 5.5 2.6 8.5 3"/><path d="M4 21V14M20 21V14M4 21h16"/><path d="M10 21v-3.5a2 2 0 014 0V21"/>',
  // 火焰
  fire: '<path d="M12 21c-4 0-6.5-2.6-6.5-6 0-3.6 3-5.4 3.6-9 2 1.4 3 3.2 3 5 .9-.8 1.6-2 1.7-3.4 2.4 1.8 4.7 4.4 4.7 7.4 0 3.4-2.5 6-6.5 6z"/><path d="M12 21c-1.8 0-3-1.2-3-2.8 0-1.8 1.6-2.6 2.2-4.4 1.6 1 3.8 2.4 3.8 4.4 0 1.6-1.2 2.8-3 2.8z"/>',
  // 元宝
  silver: '<path d="M3 11c1.5 0 2.5 1 4 1h10c1.5 0 2.5-1 4-1-.5 5-4 8-9 8s-8.5-3-9-8z"/><path d="M7.5 12c0-3 2-5.5 4.5-5.5s4.5 2.5 4.5 5.5"/>',
  // 言谈
  talk: '<path d="M4 5h16v10h-8l-5 4v-4H4z"/><path d="M8 9h8M8 12h5"/>',
  // 旗
  flag: '<path d="M5 21V3"/><path d="M5 4c4-2 7 2 13 0v9c-6 2-9-2-13 0"/>',
  // 稻谷
  grain: '<path d="M12 21V8"/><path d="M12 9c-2-1-3-3-3-5 2 .5 3 2 3 5zM12 9c2-1 3-3 3-5-2 .5-3 2-3 5zM12 14c-2.5-.5-4-2.5-4.5-4.5 2.5.3 4 2 4.5 4.5zM12 14c2.5-.5 4-2.5 4.5-4.5-2.5.3-4 2-4.5 4.5zM12 19c-2.5-.5-4-2.5-4.5-4.5 2.5.3 4 2 4.5 4.5zM12 19c2.5-.5 4-2.5 4.5-4.5-2.5.3-4 2-4.5 4.5z"/>',
  star: '<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>',
  check: '<path d="M4 12.5l5 5L20 6"/>',
  cross: '<path d="M5 5l14 14M19 5L5 19"/>',
  // 卷轴
  scroll: '<path d="M6 4h12v16H6z"/><path d="M4 4h4M16 4h4M4 20h4M16 20h4"/><path d="M9 8h6M9 11h6M9 14h4"/>',
  pick: '<path d="M4 7c4-4 12-4 16 0"/><path d="M12 5.5L8 21"/>',
  mute: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9l5 6M21 9l-5 6"/>',
  sound: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 010 7M18.5 6a8.5 8.5 0 010 12"/>',
  // 毛笔
  brush: '<path d="M19 3l2 2-9.5 9.5-2-2z"/><path d="M9.5 12.5c-2 0-3.5 1.5-3.5 3.5 0 1.5-1 3-3 3.5 3 1 7 0 8.5-2.5.6-1-.2-2.5-2-4.5z"/>',
  // 金樽
  cup: '<path d="M6 4h12c0 6-2.5 9-6 9s-6-3-6-9z"/><path d="M6 6H3.5c0 3 1.5 4.5 3.5 4.5M18 6h2.5c0 3-1.5 4.5-3.5 4.5"/><path d="M12 13v4M8 20h8M9 17h6"/>',
  look: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5.5 5.5"/>',
  // 奔走
  run: '<path d="M4 20l4-4.5 3 1.5 2-4M11.5 8.5l4 1.5 2 3M13 13l3.5 2.5 1.5 4.5M11 8.5L7.5 11"/><circle cx="14" cy="5" r="1.8"/>',
  warn: '<path d="M12 3.5L21.5 20h-19z"/><path d="M12 10v5"/><circle cx="12" cy="17.6" r=".7" class="f"/>',
  // 铺面
  shop: '<path d="M3 9l2-5h14l2 5"/><path d="M3 9c0 1.5 1.3 2.5 3 2.5S9 10.5 9 9c0 1.5 1.3 2.5 3 2.5s3-1 3-2.5c0 1.5 1.3 2.5 3 2.5s3-1 3-2.5"/><path d="M5 11.5V20h14v-8.5M10 20v-5h4v5"/>',
  hammer: '<path d="M14 4l6 6-2 2-6-6z"/><path d="M13 9L4 18l2 2 9-9"/>',
  // 酒坛
  wine: '<path d="M9 3h6M10 3v2c-3 1-5 3.5-5 7.5C5 17 8 21 12 21s7-4 7-8.5C19 8.5 17 6 14 5V3"/><path d="M8.5 12h7v4h-7z"/>',
  // 火雷
  bomb: '<circle cx="10.5" cy="14" r="6.5"/><path d="M14.5 9l2.5-2.5"/><path d="M17 6.5c.5-1.5 2-2.5 3.5-2"/><path d="M19 2.5l.4 1.2M21.5 5.5l-1.2-.3"/>',
  bow: '<path d="M6 3c8 3 11.5 9 12 18"/><path d="M6 3l12 18"/><path d="M4 12h12M13.5 9.5L16 12l-2.5 2.5"/>',
  hand: '<path d="M8 12V5.5a1.5 1.5 0 013 0V11V4a1.5 1.5 0 013 0v7V5.5a1.5 1.5 0 013 0V14c0 4-2.5 7-6.5 7-2.5 0-4-1.2-5.5-3.5L4 13.5a1.6 1.6 0 012.6-1.6L8 13.5"/>',
  // 老者
  elder: '<circle cx="12" cy="7" r="3.5"/><path d="M10 10.5c0 2 1 4 2 5 1-1 2-3 2-5"/><path d="M5 21c0-4 3-7 7-7s7 3 7 7"/>',
  shield: '<path d="M12 3l8 3v6c0 4.5-3.5 8-8 9-4.5-1-8-4.5-8-9V6z"/><path d="M12 7v10M8 11h8"/>',
  bricks: '<path d="M3 5h18v14H3zM3 9.7h18M3 14.3h18M9 5v4.7M15 5v4.7M6 9.7v4.6M12 9.7v4.6M18 9.7v4.6M9 14.3V19M15 14.3V19"/>',
  tent: '<path d="M12 3L2.5 20h19z"/><path d="M12 3v17M9 20l3-6 3 6"/><path d="M12 3l2-1"/>',
  axe: '<path d="M5 21L15.5 6"/><path d="M12.5 5.5c2-2.6 6-3.2 8.5-1.2-.4 3.2-3 6-6.5 6z"/>',
};
const MAP: Record<string, string> = {
  '⚔': 'swords', '🎲': 'dice', '🏯': 'fort', '🔥': 'fire', '💰': 'silver', '💬': 'talk', '🚩': 'flag', '🌾': 'grain', '★': 'star',
  '✔': 'check', '✘': 'cross', '✕': 'cross', '📜': 'scroll', '⛏': 'pick', '🔇': 'mute', '🔊': 'sound', '✍': 'brush', '🏆': 'cup',
  '🔍': 'look', '🏃': 'run', '⚠': 'warn', '🏪': 'shop', '⚒': 'hammer', '🍶': 'wine', '🧨': 'bomb', '🏹': 'bow', '🙋': 'hand',
  '👴': 'elder', '🛡': 'shield', '🧱': 'bricks', '⛺': 'tent', '🪓': 'axe',
};
const RE = new RegExp(`(${Object.keys(MAP).map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\uFE0F?`, 'u');

export function icon(name: string): HTMLElement {
  const s = document.createElement('span');
  s.className = `ico ico-${name}`;
  s.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${P[name] ?? ''}</svg>`;
  return s;
}
/** 把字符串中的 emoji 换成线描图标；不含 emoji 时返回 null */
export function iconize(text: string): Node[] | null {
  if (!RE.test(text)) return null;
  const out: Node[] = [];
  let rest = text;
  for (let guard = 0; guard < 20; guard++) {
    const m = RE.exec(rest);
    if (!m) break;
    if (m.index > 0) out.push(document.createTextNode(rest.slice(0, m.index)));
    out.push(icon(MAP[m[1]]));
    rest = rest.slice(m.index + m[0].length).replace(/^ /, '');
  }
  if (rest) out.push(document.createTextNode(rest));
  return out;
}
