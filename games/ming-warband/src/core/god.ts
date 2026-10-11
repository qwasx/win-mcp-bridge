// 天命（GM 上帝模式）：只对 GM 本人生效、只发给 GM 本人。单机时恒为关闭，不影响任何结算。
export interface GodState {
  on: boolean;          // 总开关
  invincible: boolean;  // 金身：本部兵马与本人刀枪不入、永不溃逃；自动结算零损失必胜
  oneHit: boolean;      // 一击必杀
  mapSpeed: number;     // 大地图行军倍速（1~50）
  battleSpeed: number;  // 战场上本部兵马的移动倍速（1~4）
  aura: boolean;        // 金光（自己看得见）
  reveal: boolean;      // 显圣：别人也看得见金光（默认关）
  hidden: boolean;      // 隐身：别人看不见你的部队、在线名单里也没有你，AI 不会追你
  any: boolean;         // 无视敌我：可以攻击/攻城任何人（含友军、新手、PvP 关闭时）
  eye: boolean;         // 天眼：大地图无视野限制
}

export const GOD_DEFAULT: GodState = {
  on: true, invincible: true, oneHit: false, mapSpeed: 8, battleSpeed: 1.6, aura: true, reveal: false, hidden: false, any: true, eye: true,
};

/** 客户端：本人的天命状态（服务器下发） */
export const GOD: GodState = { ...GOD_DEFAULT, on: false };

export function setGod(g: Partial<GodState> | null | undefined) {
  Object.assign(GOD, GOD_DEFAULT, { on: false }, g ?? {});
}

/** 规范化（服务器收到 GM 修改时用） */
export function normGod(g: Partial<GodState>): GodState {
  const n = { ...GOD_DEFAULT, ...g };
  n.mapSpeed = Math.max(1, Math.min(50, Number(n.mapSpeed) || 1));
  n.battleSpeed = Math.max(1, Math.min(4, Number(n.battleSpeed) || 1));
  for (const k of ['on', 'invincible', 'oneHit', 'aura', 'reveal', 'hidden', 'any', 'eye'] as const) n[k] = !!n[k];
  return n;
}

export const godOn = () => GOD.on;
export const godInv = () => GOD.on && GOD.invincible;

/** 客户端界面状态：下一次点地图 = 瞬移 */
export const GODUI = { tpArm: false, onTeleport: (_x: number, _y: number) => {} };
