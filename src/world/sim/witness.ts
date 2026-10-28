// 第三阶段·世界见证的对外入口（给 s2-break 的突破系统调用）
//
//   import { worldWitness } from './sim/witness';
//   worldWitness(game, { kind: 'break', who: 'hero', realm: h.realm, stage: h.stage });
//
// 效果：附近的修士看见异象 → 记成传闻（传闻栏可见，并在人群里慢慢传开）；
//      玩家突破筑基以上：本宗传讯道贺并附贺礼、同盟宗门示好拉拢、仇家里自觉还有一拼之力的那个动身来探虚实、
//      众人对你的称呼随境界与名声改变（NpcWorld.greeting 里的「前辈 / 韩前辈 / 韩老祖」）。
//      NPC 结丹、结婴（sim 内部自动调用）也会出异象，你在附近时能看见光柱与提示。
import type { Game } from '../game';
import type { WitnessEvent, SimEvent } from './world';
export type { WitnessEvent } from './world';
export function worldWitness(g: Game, ev: WitnessEvent): SimEvent { return g.npcs.sim.witness(ev); }
