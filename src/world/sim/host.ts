// 第三阶段·活世界：把 Game 接到世界模拟上（只用游戏逻辑的接口，不碰画面）
import type { Game } from '../game';
import type { NpcData } from '../npc';
import { ACTIVE_MAP, type MapId } from '../../data/world';
import { itemDef } from '../../data/items';
import { REALMS } from '../../data/realms';
import * as C from '../cultivation';
import { canAdvance } from '../demog';
import { SECT_ALLY, allyOf } from '../relations';
import { sectTitle } from '../roster';
import { bestArt, type BagItem } from './kit';
import { newSimState, type SimHost, type SimState, type Clash } from './world';

/** 玩家的储物袋 → 与 NPC 同口径的 CultView */
export function heroView(g: Game) {
  const h = g.hero;
  const bag: BagItem[] = h.bag.map((b) => ({ id: b.id, n: b.n, age: b.age }));
  return { realm: h.realm, stage: h.stage, gongfa: h.gongfa, bag, main: bestArt(bag, h.realm), name: g.player.name };
}

export function gameHost(g: Game, show: (a: NpcData, b: NpcData, k: Clash) => boolean): SimHost {
  const N = () => g.npcs;
  return {
    state(): SimState { const ws = g.ws as any; if (!ws.sim || ws.sim.v !== 1) ws.sim = newSimState(); return ws.sim; },
    list: () => N().list,
    byId: (id) => N().byId.get(id),
    day: () => g.day,
    activeMap: ACTIVE_MAP,
    player: () => ({ x: g.player.x, y: g.player.y, sense: g.senseRadius ?? 1500, map: (g.travel?.pending?.map ?? ACTIVE_MAP) as MapId, name: g.player.name }),
    hero: () => heroView(g),
    isActive: (id) => N().active.has(id),
    busy: (id) => { const a = N().active.get(id); return !!a && (!!a.enemy || !!a.duel || a.act === 'follow' || a.act === 'approach' || a.act === 'flee'); },
    showClash: show,
    die: (d, why) => N().die(d, why),
    onNpcKill: (v, k) => g.rel?.onNpcKill(v, k),
    canAdvance: (d) => canAdvance(N().list, d),
    news: (t, k) => g.news(t, k),
    toast: (t, tone) => g.toast(t, tone as any),
    omen: (x, y, realm) => {
      const c = g.combat as any; if (!c?.vfx) return;
      const col = realm >= 4 ? '200,150,255' : realm >= 3 ? '255,215,120' : '170,230,255';
      c.vfx.push({ kind: 'ring', x, y, r: 320 + realm * 120, t: 0, dur: 1.6, color: col });
      c.vfx.push({ kind: 'flash', x, y: y - 60, r: 260 + realm * 80, t: 0, dur: 1.2, color: col });
    },
    heroCongrats: (realm) => {
      const out: string[] = [], h = g.hero, rn = REALMS[realm]?.name ?? '';
      const gift = realm >= 4 ? 'pill_peiying' : realm >= 3 ? 'pill_ningyuan' : 'pill_juling';
      const sect = g.ws.sect?.id;
      if (sect) {
        C.addItem(h, gift, realm >= 3 ? 2 : 3);
        const name = sectTitle(sect);
        g.toast(`${name}传讯道贺：恭喜突破${rn}！随信附上${itemDef(gift)?.name}。`, 'good');
        out.push(`${name}闻${g.player.name}突破${rn}，遣人送来贺礼（${itemDef(gift)?.name}）。`);
      }
      // 他宗拉拢：同盟的宗门示好，敌对的暗自戒备
      const friends = sect ? allyOf(sect) : SECT_ALLY[0].ids;
      const pick = friends.filter((s) => s !== sect).slice(0, realm >= 3 ? 2 : 1);
      for (const s of pick) { g.rel?.addSect(s, 4 + realm * 2); out.push(`${sectTitle(s)}长老亲至道贺，言辞间颇有招揽之意。`); }
      if (pick.length) g.toast(`${pick.map(sectTitle).join('、')}遣人前来道贺，有意结交。`, 'info');
      return out;
    },
    sendProbe: (d) => { d.why = d.why ?? '听闻你突破，前来打探虚实'; if ((d.map ?? 'tiannan') === ACTIVE_MAP) g.rel?.startHunt(d, true, true); },
    giveSiteLoot: (x, y, items) => {
      for (const b of items) g.combat.dropLoot(x + (Math.random() - 0.5) * 120, y + (Math.random() - 0.5) * 80, b.id, b.n);
      g.toast('禁制残破，石室里灵光未散——宝物还在！', 'good');
    },
  };
}
